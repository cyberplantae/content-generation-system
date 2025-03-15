# Content Generation System ��✍️

An AI-powered content generation system that automatically creates and publishes blog posts to Webflow. Built with OpenAI's GPT and Node.js.

## 🌟 Features

- **Autonomous Content Generation**: AI creates high-quality blog posts automatically
- **Webflow Integration**: Direct publishing to your Webflow CMS
- **Smart Scheduling**: AI determines optimal posting times based on your schedule
- **Customizable Bot Profiles**: Create different writing personas with unique styles
- **Topic Management**: Easily update and manage content focus areas
- **Chat Interface**: Interact with the AI to guide content creation

## 🚀 Quick Start

1. **Prerequisites**
   - Node.js 16 or higher
   - OpenAI API key
   - Webflow API token
   - Webflow collection ID

2. **Installation**
   ```bash
   # Clone the repository
   git clone https://github.com/yourusername/content-generation-system.git
   cd content-generation-system

   # Install dependencies
   npm install
   ```

3. **Configuration**
   ```bash
   # Copy the example environment file
   cp .env.example .env

   # Edit .env with your API keys
   nano .env
   ```

4. **Run the System**
   ```bash
   npm start
   ```

## 💻 Usage

The system provides several ways to generate content:

### Command Line Interface
- Generate new blog posts
- Manage bot profiles
- Update topics
- Start autonomous mode

### Chat Commands
- `generate blog post [title]`: Create a new post
- `set topic [topic]`: Change the current topic
- `exit`: Close the program

### Autonomous Mode
The system can run independently, making smart decisions about:
- When to post new content
- What topics to cover
- How to maintain consistent brand voice

## ⚙️ Configuration

Edit `src/config.json` to customize:
- Content preferences
- Bot identity
- Posting schedule
- Content requirements
- Webflow settings

## 📖 Documentation

Detailed documentation is available in the `docs` folder:
- [Getting Started Guide](docs/getting-started.md)
- [User Guide](docs/user-guide.md)
- [Configuration Guide](docs/configuration.md)
- [Troubleshooting](docs/troubleshooting.md)

## 🛠️ Tech Stack

- **Node.js**: Runtime environment
- **TypeScript**: Programming language
- **OpenAI GPT**: AI language model
- **Webflow API**: Content management
- **Inquirer.js**: Interactive CLI

## 🤝 Contributing

Contributions are welcome! Please feel free to:
1. Fork the repository
2. Create a feature branch
3. Submit a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for their GPT models
- Webflow for their CMS API
- All contributors and users of this system

## 🔗 Links

- [OpenAI Platform](https://platform.openai.com)
- [Webflow Developers](https://developers.webflow.com)
- [Report Issues](https://github.com/yourusername/content-generation-system/issues)
