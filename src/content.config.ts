import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const pieces = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/pieces" }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		image: z.string(),
		date: z.coerce.date(),
	}),
});

const pages = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/pages" }),
	schema: z.object({
		title: z.string(),
		nav: z.boolean().default(true),
		navOrder: z.number().default(100),
	}),
});

export const collections = { pieces, pages };
