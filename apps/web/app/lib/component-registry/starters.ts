import type { Data } from "@puckeditor/core";

export const starters = [
  { id: "blank", name: "Blank canvas", description: "Nothing added. Start entirely from scratch." },
  { id: "introduction", name: "Introduction", description: "A headline, introduction, and call to action in a spacious section." },
  { id: "about", name: "About us", description: "An introduction and a two-column story section." },
  { id: "shop", name: "Shop landing", description: "A headline, live product grid, and shop/cart links. Requires a connected store." },
  { id: "contact", name: "Contact", description: "Contact details, opening hours, and an email link. No form or demo submissions." },
] as const;
export type StarterId = typeof starters[number]["id"];
export function starterDocument(starter: StarterId): Data {
  const node = (type: string, props: Record<string, unknown>) => ({ type, props: { id: `${type}-${crypto.randomUUID()}`, ...props } });
  const heading = (text: string, level = "h2") => node("Heading", { text, level });
  const text = (value: string) => node("Text", { text: value });
  let content: ReturnType<typeof node>[] = [];
  if (starter === "introduction") content = [node("Section", { padding: "large", content: [heading("A place for your next great idea.", "h1"), text("Tell your visitors what you do, who you help, and what makes you different."), node("Button", { label: "Get in touch", href: "/contact" })] })];
  if (starter === "about") content = [node("Section", { padding: "large", content: [heading("A little about us.", "h1"), text("Introduce the people and purpose behind your business."), node("Columns", { columns: 2, gap: 32, content: [node("Card", { title: "Our story", text: "Share how it all began and what brought you here." }), node("Card", { title: "Our approach", text: "Describe the values that guide your work." })] })] })];
  if (starter === "contact") content = [node("Section", { padding: "large", content: [heading("Let’s talk.", "h1"), text("Replace these details with your own contact information before publishing."), node("Card", { title: "Visit or contact us", text: "Your address · Your opening hours · Your phone number" }), node("Button", { label: "Email us", href: "mailto:hello@example.com" })] })];
  if (starter === "shop") content = [node("Section", { padding: "large", content: [heading("Find your next favorite.", "h1"), text("Explore our collection."), node("ProductGrid", { columns: 3, spacing: "medium", limit: 8, categoryId: "" }), node("ShopLink", { label: "Browse all products", destination: "shop" }), node("ShopLink", { label: "Your cart", destination: "cart" })] })];
  return { content: [], root: { props: { content } } } as Data;
}
