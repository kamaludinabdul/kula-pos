import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);

async function run() {
  try {
    const models = await genAI.getGenerativeModel({model:"gemini-1.5-flash"}).generateContent("Hi");
    console.log(models.response.text());
  } catch (err) {
    console.error(err);
  }
}
run();
