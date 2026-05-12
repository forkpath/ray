import type { IEventHandler } from '@nestjs/cqrs'

import { EventsHandler } from '@nestjs/cqrs'

import { prisma } from '@libs/pg-dao'

import { RichTextCreatedEvent } from './rich-text-created.event'

const SYSTEM_PROMPT = `You are a precise HTML-to-Markdown converter.
Convert the given HTML content to clean Markdown.
Preserve structure: headings, lists, links, bold, italic, code blocks, blockquotes, and images.
Strip all HTML attributes except href on <a> and src/alt on <img>.
Output only the converted Markdown — no explanation, no preamble.`

@EventsHandler(RichTextCreatedEvent)
export class RichTextProcessingHandler implements IEventHandler<RichTextCreatedEvent> {
  async handle(event: RichTextCreatedEvent): Promise<void> {
    const { itemId, rawContent } = event

    await prisma.collectionItem.update({
      where: { id: itemId },
      data: { aiStatus: 'processing' }
    })

    try {
      const markdown = await convertHtmlToMarkdown(rawContent)
      await prisma.collectionItem.update({
        where: { id: itemId },
        data: { content: markdown, aiStatus: 'completed' }
      })
    } catch {
      await prisma.collectionItem.update({
        where: { id: itemId },
        data: { aiStatus: 'failed' }
      })
    }
  }
}

async function convertHtmlToMarkdown(html: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: html }]
    })
  })

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`)
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>
  }

  const block = data.content.find(b => b.type === 'text')
  if (!block) throw new Error('No text block in Anthropic response')
  return block.text
}
