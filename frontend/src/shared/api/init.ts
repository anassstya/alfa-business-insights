import axios from "axios"

const init = async () => {
  const { data } = await axios.get("/roles.json");

  return data
}

export { init }