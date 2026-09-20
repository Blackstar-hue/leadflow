import type { CategorisedLead } from './types'

const categoryRules: Array<[string, RegExp]> = [
  ['Plumbing', /plumb|boiler|heating|radiator|leak|toilet|tap|pipe|drain/i],
  ['Guttering', /gutter|downpipe|fascia|soffit|roofline/i],
  ['Cladding', /cladding|render|roofline/i],
  ['Masonry', /mason|brick|repoint|wall|stone|patio/i],
  ['Tree surgery', /tree|stump|hedge|arbor|arborist/i],
  ['Solar panel cleaning', /solar|panel|photovoltaic/i],
]

export function categoriseLead(input: { message?: string; service?: string; sourceChannel?: string }): CategorisedLead {
  const text = `${input.service || ''} ${input.message || ''}`.trim()
  const matched = categoryRules.find(([, rule]) => rule.test(text))?.[0] || 'General enquiry'
  const emergency = /emergency|urgent|flood|burst|no heat|danger|fallen tree/i.test(text)
  const high = /today|asap|soon|leak|blocked|unsafe/i.test(text)
  const spam = /seo|casino|crypto|viagra|backlink|guest post/i.test(text)
  const quality = spam ? 'Low' : emergency || text.length > 35 ? 'High' : text.length > 10 ? 'Medium' : 'Low'
  return {
    serviceCategory: matched,
    urgency: emergency ? 'Emergency' : high ? 'High' : 'Normal',
    leadQuality: quality,
    spamLikelihood: spam ? 0.92 : input.sourceChannel === 'form' ? 0.04 : 0.12,
    summary: text.length > 140 ? `${text.slice(0, 137)}...` : text || 'No message supplied',
  }
}
