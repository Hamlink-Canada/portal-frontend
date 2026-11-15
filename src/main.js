import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import { createVuetify } from 'vuetify'
import { atlas, atlasDark, createVuetiwatch } from 'vuetiwatch'
import {
  VAlert,
  VApp,
  VAppBar,
  VAppBarTitle,
  VBtn,
  VBtnToggle,
  VCard,
  VCardItem,
  VCardSubtitle,
  VCardText,
  VCardTitle,
  VChip,
  VCol,
  VCombobox,
  VContainer,
  VDialog,
  VDivider,
  VAutocomplete,
  VList,
  VListItem,
  VListSubheader,
  VMain,
  VMenu,
  VNavigationDrawer,
  VProgressLinear,
  VPagination,
  VRow,
  VSelect,
  VSpacer,
  VSwitch,
  VTextField,
  VTextarea,
  VTooltip,
  VIcon,
} from 'vuetify/components'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import 'vuetiwatch/styles/core.css'
import 'vuetiwatch/styles/atlas.css'
import 'vuetiwatch/styles/atlasDark.css'
import './styles/portal.css'

import App from './App.vue'
import { createPortalAuth } from './auth.js'
import { availableLocales, messages } from './locales/index.js'
import router from './router.js'

const storedLocale = localStorage.getItem('portal-locale')
const browserLocale = navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en'
const supportedLocales = availableLocales.map(({ code }) => code)
const i18n = createI18n({
  legacy: false,
  locale: supportedLocales.includes(storedLocale) ? storedLocale : browserLocale,
  fallbackLocale: 'en',
  messages,
})

const storedTheme = localStorage.getItem('portal-theme')
const defaultTheme = storedTheme === 'light' || storedTheme === 'atlas'
  ? 'atlas'
  : 'atlasDark'
const vuetify = createVuetify({
  theme: {
    defaultTheme,
    themes: { atlas: atlas.theme, atlasDark: atlasDark.theme },
  },
  components: {
    VAlert,
    VApp,
    VAppBar,
    VAppBarTitle,
    VBtn,
    VBtnToggle,
    VCard,
    VCardItem,
    VCardSubtitle,
    VCardText,
    VCardTitle,
    VChip,
    VCol,
    VCombobox,
    VContainer,
    VDialog,
    VDivider,
    VAutocomplete,
    VList,
    VListItem,
    VListSubheader,
    VMain,
    VMenu,
    VNavigationDrawer,
    VProgressLinear,
    VPagination,
    VRow,
    VSpacer,
    VSelect,
    VSwitch,
    VTextField,
    VTextarea,
    VTooltip,
    VIcon,
  },
})

const app = createApp(App)
app.provide('portalAuth', createPortalAuth())

app
  .use(vuetify)
  .use(createVuetiwatch(vuetify, { themes: [atlas, atlasDark] }))
  .use(i18n)
  .use(router)
  .mount('#app')
