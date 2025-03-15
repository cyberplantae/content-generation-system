interface PostImage {
  url: string;
  alt: string;
  caption: string;
}

export async function postToWebflow(
  title: string, 
  content: string, 
  image?: PostImage
): Promise<any> {
  // Update your existing Webflow posting logic to include the image
  // The exact implementation will depend on your Webflow setup
} 