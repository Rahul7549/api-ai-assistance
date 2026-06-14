import dotenv from "dotenv";
import app from "./app";

const PORT =process.env.PORT||3001;
dotenv.config();


app.listen(PORT,()=>{
    console.log(`Server running on port http://localhost:${PORT}`);
})

