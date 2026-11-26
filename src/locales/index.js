import en from './en.json'
import fr from './fr.json'

export const availableLocales = [
  { code: 'en', label: 'English', flag: '🇬🇧', messages: en },
  { code: 'fr', label: 'Français', flag: '🇫🇷', messages: fr },
]

export const localeOptions = availableLocales.map(({ code, label, flag }) => ({ code, label, flag }))
export const messages = Object.fromEntries(availableLocales.map(({ code, messages }) => [code, messages]))
