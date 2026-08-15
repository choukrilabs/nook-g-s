import bcrypt from 'bcryptjs'

export async function hashPIN(pin: string): Promise<string> {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(pin, salt)
}
