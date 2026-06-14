import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/authRoutes"
import { errorHandler } from "./middleware/errorHandler";


const app=express();

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use("/api/auth",authRoutes);


app.get('/health',(_,res)=>{

    return res.status(200).json({
        success: true,
        message: "API Running"
    })

})

app.use(errorHandler);

export default app;