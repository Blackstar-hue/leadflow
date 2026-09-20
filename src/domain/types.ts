export const LEAD_STATUSES = ['New', 'Needs Review', 'Qualified', 'Assigned', 'Contacted', 'Won', 'Lost', 'Spam'] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export type LeadInput = {
  name: string
  phone: string
  email?: string
  message?: string
  service?: string
  websiteDomain?: string
  assetKey?: string
  sourceChannel?: 'form' | 'call' | 'gmb' | 'manual'
  idempotencyKey?: string
  honeypot?: string
  postcodeArea?: string
  city?: string
  gclid?: string
  gbraid?: string
  wbraid?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  landingPage?: string
  referrer?: string
  consent?: boolean
  rawPayload?: Record<string, unknown>
}

export type CategorisedLead = {
  serviceCategory: string
  urgency: 'Low' | 'Normal' | 'High' | 'Emergency'
  leadQuality: 'Low' | 'Medium' | 'High'
  spamLikelihood: number
  summary: string
}

export type RoutingCandidate = {
  renterId: string
  name: string
  priority: number
  available: boolean
  categories: string[]
}

export type DemoLead = {
  id: string
  name: string
  phone: string
  email?: string
  service: string
  summary: string
  website: string
  assetId: string
  received: string
  status: LeadStatus
  urgency: CategorisedLead['urgency']
  quality: CategorisedLead['leadQuality']
  renter: string
  source: string
  demo: true
}
