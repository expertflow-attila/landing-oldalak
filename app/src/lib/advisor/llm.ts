import type { PurchaseFacts } from './facts'

// Opcionális LLM-feljavítás a felhasználó saját Anthropic API-kulcsával.
// A kulcs csak az eszközön tárolódik (IndexedDB), exportba sosem kerül.
// Csak a determinisztikus tény-JSON megy ki, nyers tranzakciók soha.

export const DEFAULT_LLM_MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT =
  'Pénzügyi tükör vagy egy magyar költségvetés-appban. A felhasználó egy vásárlás ' +
  'előtt áll, és a saját adataiból számolt tényeket kapod meg JSON-ban. ' +
  'Írj 3-4 rövid magyar mondatot, ami tényszerűen tükröt tart: mit mutatnak az adatai. ' +
  'Szigorú szabályok: nem tiltasz, nem moralizálsz, nem utasítasz, nem minősíted a döntést. ' +
  'Csak megfigyelést és adatot fogalmazol meg, semleges, barátságos hangon. ' +
  'Nem adsz pénzügyi tanácsot, a döntés a felhasználóé.'

export async function generateAdvice(
  facts: PurchaseFacts,
  apiKey: string,
  model: string = DEFAULT_LLM_MODEL,
): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content:
          'A tervezett vásárlás tényei (a felhasználó saját adataiból számolva):\n' +
          JSON.stringify(facts, null, 2),
      },
    ],
  })

  if (response.stop_reason === 'refusal') {
    throw new Error('llm-refusal')
  }
  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
  if (!text) throw new Error('llm-empty')
  return text
}
