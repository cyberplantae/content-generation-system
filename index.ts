// index.ts

import { config } from 'dotenv';
import OpenAI from 'openai';
import { character, CharacterInfo } from './characterinfo';
import fetch from 'node-fetch';
import readline from 'readline';

// Initialize dotenv
config();

// Set up OpenAI configuration using your API key
const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
  console.error("Missing OpenAI API key in .env file.");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: openaiApiKey,
});

// Add after your OpenAI configuration
const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const WEBFLOW_COLLECTION_ID = "66e31dcd8e88bbf9b4c49e87";  // New ID from the collections response

if (!WEBFLOW_API_TOKEN) {
  console.error("Missing Webflow credentials in .env file.");
  process.exit(1);
}

console.log("Collection ID:", WEBFLOW_COLLECTION_ID); // Verify the ID is correct

// Add these interfaces and types at the top of your file
interface ContentValidation {
  minWordCount: number;
  requiredSections: string[];
  forbiddenPhrases: string[];
}

interface PostAnalytics {
  postId: string;
  title: string;
  publishDate: Date;
  wordCount: number;
  keyphraseCount: Record<string, number>;
}

// Add these interfaces at the top of the file
interface WebflowResponse {
  id: string;
  [key: string]: any;  // for other properties we might receive
}

// Build the enhanced prompt using the character info
function buildPrompt(info: CharacterInfo): string {
  return (
    `Write a 900+ word blog post titled: "${info.blogTitle}" that will be published directly to Webflow. ` +
    `Write this post from the perspective of ${info.persona} for an audience of ${info.audience}, ` +
    `in a ${info.tone} tone. Focus on these main points: ${info.mainPoints}. ` +
    `Include these keyphrases: ${info.keyphrases}. ` +
    `End with this call to action: ${info.callToAction}. ` +
    `Structure with headings (h2), subheadings (h3), introduction, and conclusion. ` +
    `Focus on SEO best practices and engagement. Write the complete post ready for immediate publication.`
  );
}

// Remove or fix the Document constructor since we're not using it
// function createWordDoc(title: string, content: string): Document {
//   return new Document({
//     sections: [{
//       properties: {},
//       children: []
//     }]
//   });
// }

// Update the postToWebflow function to include type information
async function postToWebflow(title: string, content: string): Promise<WebflowResponse> {
  try {
    console.log('Attempting to post to Webflow...');
    
    const response = await fetch(`https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`,
        'accept': 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        fieldData: {
          name: title,
          slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          "post-body": content
        }
      })
    });

    const responseData = await response.json();
    console.log('Post Response:', responseData);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${JSON.stringify(responseData)}`);
    }

    return responseData as WebflowResponse;
  } catch (error) {
    console.error('Error publishing item:', error);
    throw error;
  }
}

// Add these utility functions before generateBlogPost
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
  throw new Error('Max retries reached');
}

function validateContent(content: string, validation: ContentValidation): boolean {
  const wordCount = content.split(/\s+/).length;
  if (wordCount < validation.minWordCount) return false;

  const hasRequiredSections = validation.requiredSections.every(
    section => content.toLowerCase().includes(section.toLowerCase())
  );
  if (!hasRequiredSections) return false;

  const hasForbiddenPhrases = validation.forbiddenPhrases.some(
    phrase => content.toLowerCase().includes(phrase.toLowerCase())
  );
  if (hasForbiddenPhrases) return false;

  return true;
}

function analyzePost(content: string, title: string, id: string): PostAnalytics {
  const wordCount = content.split(/\s+/).length;
  const keyphraseCount = character.keyphrases.split(',').reduce((acc, phrase) => {
    acc[phrase.trim()] = (content.match(new RegExp(phrase.trim(), 'gi')) || []).length;
    return acc;
  }, {} as Record<string, number>);

  return {
    postId: id,
    title,
    publishDate: new Date(),
    wordCount,
    keyphraseCount
  };
}

// Update the generateBlogPost function to handle the response type
async function generateBlogPost() {
  const validation: ContentValidation = {
    minWordCount: 900,
    requiredSections: ['introduction', 'conclusion'],
    forbiddenPhrases: ['lorem ipsum', 'click here']
  };

  try {
    const blogPost = await withRetry(async () => {
      const prompt = buildPrompt(character);
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2048,
        temperature: 0.7,
      });
      return response.choices[0].message.content;
    });

    if (blogPost && validateContent(blogPost, validation)) {
      const postResponse = await postToWebflow(character.blogTitle, blogPost);
      if (postResponse && postResponse.id) {
        const analytics = analyzePost(blogPost, character.blogTitle, postResponse.id);
        console.log('Post Analytics:', analytics);
      }
    } else {
      throw new Error('Content validation failed');
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

// After the interfaces (around line 54), add:
interface ElizaMemory {
  conversationHistory: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
  }>;
  contentPreferences: {
    topics: string[];
    style: string;
    tone: string;
    targetAudience: string;
  };
  lastGeneratedContent?: {
    title: string;
    content: string;
    analytics: PostAnalytics;
  };
}

interface EnhancedMemory extends ElizaMemory {
  longTermMemory: {
    topics: {
      name: string;
      confidence: number;
      lastUsed: Date;
      performance: {
        views: number;
        engagement: number;
      };
    }[];
    patterns: {
      timeOfDay: Record<string, number>;
      topicPerformance: Record<string, number>;
      audiencePreferences: Record<string, number>;
    };
  };
  personality: {
    interests: string[];
    writingStyle: string;
    confidence: number;
    mood: string;
  };
}

class EnhancedEliza {
  protected openai: OpenAI;
  private memory: ElizaMemory;
  private systemPrompt: string;

  constructor(openaiClient: OpenAI) {
    this.openai = openaiClient;
    this.memory = {
      conversationHistory: [],
      contentPreferences: {
        topics: [],
        style: 'professional',
        tone: 'friendly',
        targetAudience: 'general'
      }
    };
    this.systemPrompt = `You are ELIZA, an AI content strategist and writer. 
    You help users develop content ideas, write blog posts, and improve their content strategy. 
    You maintain a professional yet approachable tone and focus on actionable advice.`;
  }

  async chat(input: string): Promise<string> {
    const command = input.toLowerCase();
    if (command.includes('generate blog post')) {
        console.log("Manual blog post generation requested...");
        const title = command.replace('generate blog post', '').trim();
        try {
            await this.generateAndPostContent(title || undefined);
            return "✅ Blog post has been generated and published to Webflow!";
        } catch (error) {
            console.error("Error during manual post generation:", error);
            return "❌ Sorry, there was an error generating the blog post.";
        }
    }

    if (command.includes('set topic')) {
      const topic = command.replace('set topic', '').trim();
      this.updateContentPreferences({ topics: [topic] });
      return `Topic updated to: ${topic}`;
    }

    // Add user input to history
    this.memory.conversationHistory.push({
      role: 'user',
      content: input,
      timestamp: new Date()
    });

    // Regular chat response
    const messages = [
      { role: 'system' as const, content: this.systemPrompt },
      ...this.memory.conversationHistory.slice(-5).map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content
      }))
    ];

    const response = await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      temperature: 0.7,
    });

    const reply = response.choices[0].message.content || "I'm not sure how to respond to that.";

    // Add response to history
    this.memory.conversationHistory.push({
      role: 'assistant',
      content: reply,
      timestamp: new Date()
    });

    return reply;
  }

  private formatTitle(title: string): string {
    return title
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  protected async generateAndPostContent(customTitle?: string): Promise<void> {
    console.log(`Starting content generation${customTitle ? ` for: ${customTitle}` : ''}`);
    const prefs = this.memory.contentPreferences;
    const character: CharacterInfo = {
      blogTitle: this.formatTitle(customTitle || `${prefs.topics[0]} Guide`),
      persona: "Professional Content Strategist",
      audience: prefs.targetAudience,
      tone: prefs.tone,
      mainPoints: prefs.topics.join(', '),
      keyphrases: prefs.topics.join(', '),
      callToAction: "Start implementing these strategies today"
    };

    try {
      console.log("Generating blog content...");
      const blogPost = await withRetry(async () => {
        const prompt = buildPrompt(character);
        const response = await this.openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { 
              role: "system", 
              content: "You are a direct content creator. Generate only the blog post content, without any meta-commentary or suggestions. The content will be published directly to Webflow."
            },
            { role: "user", content: prompt }
          ],
          max_tokens: 2048,
          temperature: 0.7,
        });
        return response.choices[0].message.content;
      });

      if (!blogPost) {
        throw new Error("No content generated");
      }

      console.log("Content generated, posting to Webflow...");
      const postResponse = await postToWebflow(character.blogTitle, blogPost);
      
      if (postResponse && postResponse.id) {
        const analytics = analyzePost(blogPost, character.blogTitle, postResponse.id);
        this.memory.lastGeneratedContent = {
          title: character.blogTitle,
          content: blogPost,
          analytics
        };
        console.log(`Successfully published "${character.blogTitle}" to Webflow!`);
      } else {
        throw new Error("Failed to get post response from Webflow");
      }
    } catch (error) {
      console.error("Error in generateAndPostContent:", error);
      throw error; // Re-throw to handle in calling functions
    }
  }

  public updateContentPreferences(preferences: Partial<ElizaMemory['contentPreferences']>): void {
    this.memory.contentPreferences = {
      ...this.memory.contentPreferences,
      ...preferences
    };
  }
}

class AutonomousEliza extends EnhancedEliza {
  private longTermMemory: EnhancedMemory['longTermMemory'];
  private decisionThreshold: number = 0.7;
  private lastPostTime: Date = new Date();

  constructor(openaiClient: OpenAI) {
    super(openaiClient);
    this.longTermMemory = {
      topics: [],
      patterns: {
        timeOfDay: {},
        topicPerformance: {},
        audiencePreferences: {}
      }
    };
  }

  async makeAutonomousDecision(): Promise<void> {
    const now = new Date();
    const hoursSinceLastPost = (now.getTime() - this.lastPostTime.getTime()) / (1000 * 60 * 60);

    console.log(`\n[AUTONOMOUS MODE] Checking if I should post...`);
    console.log(`Hours since last post: ${hoursSinceLastPost.toFixed(1)}`);

    if (hoursSinceLastPost < 24) {
      console.log(`Too soon to post again. Waiting...`);
      return;
    }

    const decision = await this.evaluatePostingDecision();
    console.log(`Decision made: ${decision.shouldPost ? 'Will post' : 'Will wait'}`);
    if (decision.shouldPost) {
      try {
        console.log(`[AUTONOMOUS MODE] Generating post about: ${decision.topic}`);
        await this.generateAndPostContent(decision.topic);
        this.lastPostTime = now;
        this.updateMemoryWithPerformance(decision.topic);
        console.log(`[AUTONOMOUS MODE] Post published successfully!`);
      } catch (error) {
        console.error("[AUTONOMOUS MODE] Failed to generate/post content:", error);
      }
    }
  }

  private async evaluatePostingDecision(): Promise<{ shouldPost: boolean; topic: string }> {
    const prompt = `As an AI content strategist, analyze the following:
    - Last post was ${(new Date().getTime() - this.lastPostTime.getTime()) / (1000 * 60 * 60)} hours ago
    - Current time: ${new Date().toLocaleTimeString()}
    - Past successful topics: ${this.longTermMemory.topics.map(t => t.name).join(', ')}
    - Current trends in content marketing
    
    Should I create a new blog post now? If yes, suggest a topic.
    Respond in JSON format: { "shouldPost": boolean, "topic": string, "reasoning": string }`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a strategic content planning AI. Make data-driven decisions." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    });

    try {
      const decision = JSON.parse(response.choices[0].message.content || "{}");
      console.log(`Decision reasoning: ${decision.reasoning}`);
      return {
        shouldPost: decision.shouldPost,
        topic: decision.topic || this.generateNewTopic()
      };
    } catch (error) {
      console.error("Error parsing decision:", error);
      return {
        shouldPost: false,
        topic: ""
      };
    }
  }

  private generateNewTopic(): string {
    // Use existing topics to generate related but new topics
    const existingTopics = this.longTermMemory.topics.map(t => t.name).join(', ');
    return `Advanced ${existingTopics.split(',')[0]} Strategies`;
  }

  private updateMemoryWithPerformance(topic: string): void {
    // Simulate performance metrics (replace with real analytics)
    const performance = {
      views: Math.floor(Math.random() * 1000),
      engagement: Math.random()
    };

    this.longTermMemory.topics.push({
      name: topic,
      confidence: Math.random(),
      lastUsed: new Date(),
      performance
    });
  }
}

// Comment out line 198:
// generateBlogPost();

// Keep runAutonomousAgent and its execution at the bottom
async function runAutonomousAgent() {
  const eliza = new AutonomousEliza(openai);
  
  // Run decision-making loop
  setInterval(async () => {
    await eliza.makeAutonomousDecision();
  }, 1000 * 60 * 5); // Check every 5 minutes

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("ELIZA: I'm now running autonomously, but you can still chat with me!");
  console.log("Commands: 'generate blog post [title]' or 'set topic [topic]'");

  rl.on('line', async (input) => {
    if (input.toLowerCase() === 'exit') {
      rl.close();
      process.exit(0);
    }
    try {
      const response = await eliza.chat(input);
      console.log('ELIZA:', response);
    } catch (error) {
      console.error('Error:', error);
    }
  });
}

// Start the agent
runAutonomousAgent();

export { AutonomousEliza, EnhancedEliza };

