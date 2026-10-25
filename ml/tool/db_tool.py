"""Read-only tools for an agent exploring the project PostgreSQL database.

Example::

    with DatabaseTools.from_env() as db:
        db.list_tables()
        db.describe_table("companies")
        db.find_rows("companies", "synthetic_u", "U_14366")
        tools = db.tool_definitions()  # pass as tools=tools to chat completions
        db.call_tool("list_tables", {})  # dispatch a model tool call

The public methods have descriptions and JSON-friendly inputs/outputs so they can
be registered as agent tools. No method accepts arbitrary SQL.
"""

from __future__ import annotations

from copy import deepcopy
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from sqlalchemy import Engine, MetaData, Table, inspect, select

from ml.src.profile_repository import SupabaseSettings


TABLE_DESCRIPTIONS = {
    "companies": "Профили компаний; synthetic_u — идентификатор компании, group_id — идентификатор группы.",
    "person_company_links": "Связи людей (synthetic_f) с компаниями (synthetic_u); роль человека не указана.",
    "payments": "Платежные связи между компаниями: payer → beneficiary, pay_amt — сумма, pay_cnt — число платежей.",
}
LOGICAL_RELATIONSHIPS = [
    {"from": "person_company_links.synthetic_u", "to": "companies.synthetic_u",
     "meaning": "Человек связан с компанией", "declared_foreign_key": False},
    {"from": "payments.payer", "to": "companies.synthetic_u",
     "meaning": "Компания выступает плательщиком", "declared_foreign_key": False},
    {"from": "payments.beneficiary", "to": "companies.synthetic_u",
     "meaning": "Компания выступает получателем", "declared_foreign_key": False},
    {"from": "companies.group_id", "to": "companies.group_id",
     "meaning": "Общий group_id объединяет компании в группу", "declared_foreign_key": False},
]


def _json_value(value: Any) -> Any:
    """Convert database scalar values to JSON-compatible values without losing decimals."""
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, bytes):
        return value.hex()
    return value


class DatabaseTools:
    """Methods for schema discovery and bounded, read-only data retrieval."""

    def __init__(self, engine: Engine, *, owns_engine: bool = False):
        self.engine = engine
        self._owns_engine = owns_engine

    @classmethod
    def from_env(cls) -> DatabaseTools:
        """Create bounded read tools with the shared explicit remote settings."""
        return cls(SupabaseSettings().create_engine(), owns_engine=True)

    def close(self) -> None:
        """Release the engine created by from_env()."""
        if self._owns_engine:
            self.engine.dispose()

    def __enter__(self) -> DatabaseTools:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    @staticmethod
    def _check_table(table_name: str) -> None:
        if table_name not in TABLE_DESCRIPTIONS:
            raise ValueError(f"Unknown table: {table_name}. Available: {', '.join(TABLE_DESCRIPTIONS)}")

    @staticmethod
    def _check_page(limit: int, offset: int) -> None:
        if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 100:
            raise ValueError("limit must be an integer from 1 to 100")
        if isinstance(offset, bool) or not isinstance(offset, int) or offset < 0:
            raise ValueError("offset must be a non-negative integer")

    def _table(self, table_name: str) -> Table:
        self._check_table(table_name)
        return Table(table_name, MetaData(), autoload_with=self.engine, schema="public")

    def list_tables(self) -> list[dict[str, str]]:
        """List available dataset tables and explain what each contains. Call first to discover the database."""
        available = set(inspect(self.engine).get_table_names(schema="public"))
        return [
            {"table": name, "description": description}
            for name, description in TABLE_DESCRIPTIONS.items()
            if name in available
        ]

    def describe_table(self, table_name: str) -> dict[str, Any]:
        """Show columns, types, nullability, primary keys and declared foreign keys of one table."""
        self._check_table(table_name)
        inspector = inspect(self.engine)
        columns = inspector.get_columns(table_name, schema="public")
        primary_key = inspector.get_pk_constraint(table_name, schema="public").get("constrained_columns", [])
        foreign_keys = inspector.get_foreign_keys(table_name, schema="public")
        return {
            "table": table_name,
            "description": TABLE_DESCRIPTIONS[table_name],
            "columns": [
                {"name": column["name"], "type": str(column["type"]),
                 "nullable": column["nullable"], "primary_key": column["name"] in primary_key}
                for column in columns
            ],
            "foreign_keys": [
                {"columns": key["constrained_columns"], "target_table": key["referred_table"],
                 "target_columns": key["referred_columns"]}
                for key in foreign_keys
            ],
        }

    def describe_relationships(self) -> dict[str, Any]:
        """Explain how companies, people and payments connect; mark inferred links separately from SQL foreign keys."""
        return {
            "relationships": LOGICAL_RELATIONSHIPS,
            "note": "Связи следуют из структуры данных; внешние ключи для них в миграции не объявлены. "
                    "Идентификаторы контрагентов могут отсутствовать в companies.",
        }

    def get_rows(self, table_name: str, limit: int = 20, offset: int = 0) -> dict[str, Any]:
        """Read a page of raw rows from a table. Use describe_table first; limit is at most 100."""
        return self._read_rows(table_name, None, None, limit, offset)

    def find_rows(
        self, table_name: str, column_name: str, value: str,
        limit: int = 20, offset: int = 0,
    ) -> dict[str, Any]:
        """Find rows where one column exactly equals value; useful for company, person or group IDs."""
        return self._read_rows(table_name, column_name, value, limit, offset)

    def _read_rows(
        self, table_name: str, column_name: str | None, value: str | None,
        limit: int, offset: int,
    ) -> dict[str, Any]:
        self._check_page(limit, offset)
        table = self._table(table_name)
        query = select(table)
        if column_name is not None:
            if column_name not in table.c:
                raise ValueError(f"Unknown column {column_name} in {table_name}")
            query = query.where(table.c[column_name] == value)
        query = query.order_by(table.c.id).limit(limit + 1).offset(offset)
        with self.engine.connect() as connection:
            rows = connection.execute(query).mappings().fetchall()
        return {
            "table": table_name,
            "rows": [{key: _json_value(item) for key, item in row.items()} for row in rows[:limit]],
            "limit": limit,
            "offset": offset,
            "has_more": len(rows) > limit,
        }

    @staticmethod
    def tool_definitions() -> list[dict[str, Any]]:
        """Return OpenAI-compatible function definitions for the five read-only tools."""
        return deepcopy(TOOL_DEFINITIONS)

    def call_tool(self, name: str, arguments: dict[str, Any]) -> Any:
        """Execute an allowlisted tool by name with named arguments."""
        if name not in TOOL_METHODS:
            raise ValueError(f"Unknown tool: {name}")
        if not isinstance(arguments, dict):
            raise ValueError("arguments must be a dictionary")
        return getattr(self, name)(**arguments)


# Register these bound methods in an agent framework; each docstring describes its use.
TOOL_METHODS = (
    "list_tables", "describe_table", "describe_relationships", "get_rows", "find_rows",
)

_TABLE = {"type": "string", "enum": list(TABLE_DESCRIPTIONS)}
_LIMIT = {"type": "integer", "minimum": 1, "maximum": 100, "description": "Размер страницы."}
_OFFSET = {"type": "integer", "minimum": 0, "description": "Число пропущенных строк."}


def _definition(name: str, description: str, properties: dict[str, Any], required: list[str]) -> dict[str, Any]:
    return {"type": "function", "function": {"name": name, "description": description,
            "parameters": {"type": "object", "properties": properties,
                           "required": required, "additionalProperties": False}}}


TOOL_DEFINITIONS = [
    _definition("list_tables", "Узнать, какие таблицы доступны и что в них хранится.", {}, []),
    _definition("describe_table", "Посмотреть колонки, типы и ключи таблицы.",
                {"table_name": _TABLE}, ["table_name"]),
    _definition("describe_relationships", "Узнать, как связаны компании, люди, группы и платежи.", {}, []),
    _definition("get_rows", "Получить страницу исходных строк таблицы.",
                {"table_name": _TABLE, "limit": _LIMIT, "offset": _OFFSET}, ["table_name"]),
    _definition("find_rows", "Найти строки таблицы по точному совпадению значения в одной колонке.",
                {"table_name": _TABLE, "column_name": {"type": "string"},
                 "value": {"type": "string"}, "limit": _LIMIT, "offset": _OFFSET},
                ["table_name", "column_name", "value"]),
]
