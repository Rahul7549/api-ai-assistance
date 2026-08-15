import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/authRoutes";
import assistantRoutes from "./routes/assistantRoutes";
import conversationRoutes from "./routes/conversationRoutes";
import pdfRoutes from "./routes/pdfRoutes";
import { errorHandler } from "./middleware/errorHandler";


const app=express();

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use("/api/auth",authRoutes);
app.use("/api/assistants", assistantRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/pdf", pdfRoutes);


app.get('/health',(_,res)=>{

    return res.status(200).json({
        success: true,
        message: "API Running"
    })

})

app.use(errorHandler);

export default app;