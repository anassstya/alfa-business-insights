import styled from "styled-components";

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const UserCard = styled.div`
  padding: 16px;
  border-radius: 16px;
  background-color: ${({ theme }) => theme.colors.secondary.sectionBg};
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export { Form, UserCard };
