import express from 'express';
import cors from 'cors';
import { AutonomousEliza } from './eliza';
import { OpenAI } from 'openai';

const app = express();
const port: number = Number(process.env.PORT) || 3002;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const eliza = new AutonomousEliza(openai);

app.get('/', (req, res) => {
  res.render('index');
});

app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const response = await eliza.chat(message);
    res.json({ response });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({ response: 'An error occurred while processing your request.' });
  }
});

app.post('/generate-post', async (req, res) => {
  try {
    const { title } = req.body;
    await eliza.generateAndPostContent(title);
    res.json({ success: true, message: 'Blog post generated and published!' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate post' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  // Start autonomous checking
  setInterval(async () => {
    await eliza.makeAutonomousDecision();
  }, 1000 * 60 * 5);
}).on('error', (err: { code: string }) => {
  if (err.code === 'EADDRINUSE') {
    const newPort = port + 1;
    console.log(`Port ${port} is busy, trying ${newPort}...`);
    app.listen(newPort);
  } else {
    console.error('Server error:', err);
  }
});

export { AutonomousEliza }; 