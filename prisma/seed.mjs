import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const assets = [
  { assetId: 'AG-001', code: 'BIZ-001', name: 'Premier Plumbing Portsmouth', domain: 'premierplumbingportsmouth.xyz', phone: '+447401471852', status: 'CONNECTED' },
  { assetId: 'AG-002', code: 'BIZ-002', name: 'Premier Gutter and Cladding Portsmouth', domain: 'premiergutterandcladdingportsmouth.xyz', phone: '+447307273963', status: 'CONNECTED' },
  { assetId: 'AG-003', code: 'BIZ-003', name: 'United Masonry Northampton', domain: 'unitedmasonrynorthampton.xyz', phone: '+447576552408', status: 'CONNECTED' },
  { assetId: 'PENDING-004', code: 'BIZ-004', name: 'Ashwood Tree Surgeons Corby', domain: null, phone: null, status: 'PENDING' },
  { assetId: 'PENDING-005', code: 'BIZ-005', name: 'Sunshine Solar Cleaning Corby', domain: null, phone: null, status: 'PENDING' },
]

async function main() {
  const workspace = await prisma.workspace.upsert({ where: { slug: 'master-workspace' }, update: {}, create: { slug: 'master-workspace', name: 'Master workspace' } })
  for (const asset of assets) {
    const business = await prisma.business.upsert({ where: { workspaceId_code: { workspaceId: workspace.id, code: asset.code } }, update: { name: asset.name }, create: { workspaceId: workspace.id, code: asset.code, name: asset.name } })
    let website = null
    if (asset.domain) website = await prisma.website.upsert({ where: { workspaceId_domain: { workspaceId: workspace.id, domain: asset.domain } }, update: { status: asset.status }, create: { workspaceId: workspace.id, businessId: business.id, domain: asset.domain, status: asset.status } })
    await prisma.gmbAsset.upsert({ where: { workspaceId_assetId: { workspaceId: workspace.id, assetId: asset.assetId } }, update: { name: asset.name, phone: asset.phone, status: asset.status, websiteId: website?.id }, create: { workspaceId: workspace.id, businessId: business.id, websiteId: website?.id, assetId: asset.assetId, name: asset.name, phone: asset.phone, status: asset.status } })
  }
  console.log(`Seeded ${assets.length} known assets into ${workspace.name}. No demo leads or renters were created.`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
