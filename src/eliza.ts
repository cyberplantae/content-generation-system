// index.ts

import { config } from 'dotenv';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import readline from 'readline';
import fs from 'fs';


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

interface ValidationScores {
  depth: number;
  accuracy: number;
  practicalValue: number;
  writingQuality: number;
  engagement: number;
}

interface ContentCharacter {
  blogTitle: string;
  persona: string;
  audience: string;
  tone: string;
  mainPoints: string;
  keyphrases: string;
  callToAction: string;
}

// Build the enhanced prompt using the character info
function buildPrompt(info: ContentCharacter): string {
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
async function postToWebflow(title: string, content: string, image?: { url: string; alt: string; caption: string }): Promise<WebflowResponse> {
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
          "post-body": content,
          image
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
  private config: any;
  private systemPrompt: string;

  constructor(openaiClient: OpenAI) {
    this.openai = openaiClient;
    this.config = JSON.parse(fs.readFileSync('./src/config.json', 'utf-8'));
    this.memory = {
      conversationHistory: [],
      contentPreferences: this.config.contentPreferences
    };
    this.systemPrompt = `You are ${this.config.botIdentity.profiles[this.config.botIdentity.currentProfile].name}, ${this.config.botIdentity.profiles[this.config.botIdentity.currentProfile].domain}`;
  }

  private async gatherResearch(topic: string) {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { 
          role: "system", 
          content: "You are a research expert. Return only JSON data."
        },
        { 
          role: "user", 
          content: `Research ${topic} and return: { "keyPoints": string[], "scientificFacts": string[], "traditionalUses": string[] }`
        }
      ],
      temperature: 0.3,
    });

    try {
      return JSON.parse(response.choices[0].message.content || "{}");
    } catch (error) {
      return { keyPoints: [topic], scientificFacts: [], traditionalUses: [] };
    }
  }

  private formatTitle(title: string): string {
    return title
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private buildPrompt(info: ContentCharacter): string {
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

  public async generateAndPostContent(customTitle?: string): Promise<void> {
    console.log(`Starting content generation${customTitle ? ` for: ${customTitle}` : ''}`);
    const prefs = this.memory.contentPreferences;
    const profile = this.config.botIdentity.profiles[this.config.botIdentity.currentProfile];

    // First gather research data
    const researchData = await this.gatherResearch(customTitle || prefs.topics[0]);

    // Then build character info using the research
    const character: ContentCharacter = {
      blogTitle: this.formatTitle(customTitle || `${prefs.topics[0]} Guide`),
      persona: profile.domain,
      audience: prefs.targetAudience,
      tone: profile.writingStyle.tone,
      mainPoints: researchData.keyPoints.join(', '),
      keyphrases: prefs.topics.join(', '),
      callToAction: profile.callToAction || "Start your journey into sustainable cultivation"
    };

    try {
      console.log("Generating blog content...");
      const blogPost = await withRetry(async () => {
        const prompt = this.buildPrompt(character);
        const response = await this.openai.chat.completions.create({
          model: "gpt-4-turbo-preview",
          messages: [
            { 
              role: "system", 
              content: "You are a direct content creator. Generate only the blog post content, without any meta-commentary or suggestions."
            },
            { role: "user", content: prompt }
          ],
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
        const analytics = this.analyzePost(blogPost, character.blogTitle, postResponse.id);
        this.memory.lastGeneratedContent = {
          title: character.blogTitle,
          content: blogPost,
          analytics
        };
        console.log(`Successfully published "${character.blogTitle}" to Webflow!`);
      }
    } catch (error) {
      console.error("Error in generateAndPostContent:", error);
      throw error;
    }
  }

  private analyzePost(content: string, title: string, id: string): PostAnalytics {
    const wordCount = content.split(/\s+/).length;
    const keyphraseCount = this.memory.contentPreferences.topics.reduce((acc: Record<string, number>, phrase: string) => {
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

  public async chat(input: string): Promise<string> {
    this.memory.conversationHistory.push({
      role: 'user',
      content: input,
      timestamp: new Date()
    });

    const messages = [
      { role: 'system' as const, content: this.systemPrompt },
      { role: 'system' as const, content: `Current topics: ${this.memory.contentPreferences.topics.join(', ')}\nTone: ${this.memory.contentPreferences.tone}` },
      ...this.memory.conversationHistory.slice(-5).map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content
      }))
    ];

    const response = await this.openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: messages,
      temperature: 0.7,
    });

    const reply = response.choices[0].message.content || "I'm not sure how to respond to that.";

    this.memory.conversationHistory.push({
      role: 'assistant',
      content: reply,
      timestamp: new Date()
    });

    return reply;
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
      model: "gpt-o1-mini",
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

