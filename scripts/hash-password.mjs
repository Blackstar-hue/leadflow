import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { hashPassword } from '../server/auth.mjs'

const password = process.argv[2]
if (password) {
  console.log(hashPassword(password))
  process.exit(0)
}

const prompt = createInterface({ input, output })
const answer = await prompt.question('Admin password (input will be visible in this terminal): ')
prompt.close()
console.log(hashPassword(answer))
