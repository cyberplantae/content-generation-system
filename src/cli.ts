import inquirer from 'inquirer';
import type { QuestionCollection } from 'inquirer';
import fs from 'fs/promises';
import { AutonomousEliza } from './eliza';
import { OpenAI } from 'openai';
import { EnhancedEliza } from './eliza';

async function main() {
  console.log('Welcome to the Content Generation System!\n');

  const config = JSON.parse(await fs.readFile('./src/config.json', 'utf-8'));
  const eliza = new EnhancedEliza(new OpenAI());

  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          'Generate a new blog post',
          'Manage bot profiles',
          'Update topics',
          'Start autonomous mode',
          'Exit'
        ]
      }
    ]);

    switch (action) {
      case 'Generate a new blog post':
        const postDetails = await inquirer.prompt([
          {
            type: 'input',
            name: 'title',
            message: 'What should the blog post be about? (Press enter for auto-generated topic)'
          },
          {
            type: 'list',
            name: 'tone',
            message: 'Select the tone for this post:',
            choices: ['educational', 'conversational', 'professional', 'friendly']
          }
        ]);
        
        await eliza.generateAndPostContent(postDetails.title || undefined);
        break;

      case 'Manage bot profiles':
        await manageBotProfiles(config);
        await fs.writeFile('./src/config.json', JSON.stringify(config, null, 2));
        break;

      case 'Update topics':
        const topicsUpdate = await inquirer.prompt([
          {
            type: 'editor',
            name: 'topics',
            message: 'Enter your topics (one per line):',
            default: config.contentPreferences.topics.join('\n')
          }
        ]);
        
        config.contentPreferences.topics = topicsUpdate.topics
          .split('\n')
          .map((t: string) => t.trim())
          .filter(Boolean);
        
        await fs.writeFile('./src/config.json', JSON.stringify(config, null, 2));
        console.log('Topics updated successfully!');
        break;

      case 'Start autonomous mode':
        console.log('Starting autonomous mode...');
        const autonomousEliza = new AutonomousEliza(new OpenAI());
        await autonomousEliza.makeAutonomousDecision();
        break;

      case 'Exit':
        console.log('Goodbye!');
        process.exit(0);
    }
  }
}

async function manageBotProfiles(config: any) {
  const profileChoices = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do with bot profiles?',
      choices: [
        'Switch active profile',
        'Create new profile',
        'Back to main menu'
      ]
    }
  ]);

  switch (profileChoices.action) {
    case 'Create new profile':
      const newProfile = await inquirer.prompt([
        {
          type: 'input',
          name: 'profileName',
          message: 'Enter a name for this profile (e.g., tech-reviewer):'
        },
        {
          type: 'input',
          name: 'botName',
          message: 'What name should this bot have?'
        },
        {
          type: 'input',
          name: 'domain',
          message: 'What is this bot\'s domain of expertise?'
        },
        {
          type: 'list',
          name: 'tone',
          message: 'Select the primary tone for content:',
          choices: [
            'technical and detailed',
            'casual and friendly',
            'professional and authoritative',
            'enthusiastic and engaging'
          ]
        }
      ]);

      config.botIdentity.profiles[newProfile.profileName] = {
        name: newProfile.botName,
        domain: newProfile.domain,
        writingStyle: {
          tone: newProfile.tone
        }
      };
      console.log('New profile created successfully!');
      break;

    case 'Switch active profile':
      const profileNames = Object.keys(config.botIdentity.profiles);
      const switchProfile = await inquirer.prompt([
        {
          type: 'list',
          name: 'profile',
          message: 'Select the profile to switch to:',
          choices: profileNames
        }
      ]);
      
      config.botIdentity.currentProfile = switchProfile.profile;
      console.log(`Switched to ${switchProfile.profile} profile!`);
      break;
  }
}

main().catch(console.error); 