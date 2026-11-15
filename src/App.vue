<script setup>
import { computed, inject, onMounted, ref, watch, watchEffect } from 'vue'
import { useDisplay, useTheme } from 'vuetify'
import { useVuetiwatch } from 'vuetiwatch'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { localeOptions } from './locales/index.js'
import SitesView from './views/SitesView.vue'
import RepeatersView from './views/RepeatersView.vue'
import EntitiesView from './views/EntitiesView.vue'
import { getUnsavedChangesMessage } from './utils/unsavedChanges.js'

const { t, locale } = useI18n()
const auth = inject('portalAuth')
const portalConfig = inject('portalConfig')
const theme = useTheme()
const vuetiwatch = useVuetiwatch()
const route = useRoute()
const router = useRouter()
const { mobile } = useDisplay()
const activeSection = computed(() => route.meta.section || route.name || 'overview')
const drawerOpen = ref(!mobile.value)
const identity = ref(null)
const authError = ref('')
const isLoading = ref(true)
const previewUserVersion = ref(0)
const previewUsers = ref([])
const selectedPreviewUserId = ref('')
const isDevMode = import.meta.env.DEV
  && String(import.meta.env.VITE_PORTAL_DEV_MODE).toLowerCase() === 'true'
const displayName = computed(() => portalConfig.managementDisplayName || t('management.title'))
const brandInitial = computed(() => {
  return Array.from(String(displayName.value).trim())[0]?.toLocaleUpperCase() || 'P'
})
const isDark = computed(() => theme.global.name.value === 'atlasDark')
const selectedLocale = computed(() => localeOptions.find((option) => option.code === locale.value) || localeOptions[0])
const accountEditUrl = computed(() => {
  const configuredUrl = portalConfig.accountManagementUrl
  if (configuredUrl) return configuredUrl
  const issuer = portalConfig.oidcAuthority
  if (!issuer) return ''
  try {
    const url = new URL(issuer)
    url.pathname = `${url.pathname.replace(/\/$/, '').replace(/\/protocol\/openid-connect$/i, '')}/account/`
    url.hash = '/personal-info'
    return url.toString()
  } catch {
    return ''
  }
})
const sections = ['overview', 'entities', 'sites', 'repeaters', 'profile']
const sectionIcons = {
  overview: 'M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6',
  entities: 'M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM16 3.2a3.5 3.5 0 0 1 0 6.8M17 14.5a4 4 0 0 1 4 4V20',
  sites: 'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0ZM12 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  repeaters: 'M12 3v4M5.6 6.2l2.8 2.8M3 13h4M17 13h4M15.6 9l2.8-2.8M7 21a5 5 0 1 1 10 0M9.5 17.5a2.5 2.5 0 1 1 5 0',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
}
const previewUserItems = computed(() => previewUsers.value.map((user) => ({
  ...user,
  title: user.name,
  value: user.id,
})))
watchEffect(() => {
  document.documentElement.lang = locale.value
  document.title = displayName.value
})

watch(mobile, (isMobile) => {
  drawerOpen.value = !isMobile
}, { immediate: true })

function setLocale(language) {
  locale.value = language
  localStorage.setItem('portal-locale', language)
}

function toggleDarkMode(event) {
  const name = isDark.value ? 'atlas' : 'atlasDark'
  vuetiwatch.change(name, event)
  localStorage.setItem('portal-theme', name)
}

async function loadIdentity() {
  authError.value = ''
  try {
    const result = await auth.apiFetch('v1/session')
    identity.value = result.user
  } catch (error) {
    authError.value = error instanceof Error ? error.message : String(error)
  }
}

async function signIn() {
  authError.value = ''
  try {
    await auth.signIn(selectedPreviewUserId.value)
    if (isDevMode) await loadIdentity()
  } catch (error) {
    authError.value = error instanceof Error ? error.message : String(error)
  }
}

async function signOut() {
  const unsavedMessage = getUnsavedChangesMessage()
  if (unsavedMessage && !window.confirm(unsavedMessage)) return
  try {
    await auth.signOut()
    if (isDevMode) identity.value = null
  } catch (error) {
    authError.value = error instanceof Error ? error.message : String(error)
  }
}

async function setPreviewUser(userId) {
  const unsavedMessage = getUnsavedChangesMessage()
  if (unsavedMessage && !window.confirm(unsavedMessage)) return
  try {
    await auth.setPreviewUser(userId)
    await loadIdentity()
    previewUserVersion.value += 1
  } catch (error) {
    authError.value = error instanceof Error ? error.message : String(error)
  }
}

function openSection(section) {
  router.push({ name: section })
  if (mobile.value) drawerOpen.value = false
}

onMounted(async () => {
  try {
    if (isDevMode) {
      previewUsers.value = await auth.listPreviewUsers()
      selectedPreviewUserId.value = previewUsers.value.find(
        (user) => user.username === 'portal.reviewer',
      )?.id || previewUsers.value[0]?.id || ''
    }
    const user = await auth.initialize()
    if (user) {
      await loadIdentity()
      const returnTo = auth.takeReturnTo()
      if (identity.value && returnTo) await router.replace(returnTo)
    }
  } catch (error) {
    authError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <v-app>
    <v-app-bar class="portal-app-bar" flat border="b">
      <v-btn
        v-if="identity"
        class="navigation-toggle mr-2"
        variant="text"
        :aria-label="t(drawerOpen ? 'management.closeNavigation' : 'management.openNavigation')"
        :title="t(drawerOpen ? 'management.closeNavigation' : 'management.openNavigation')"
        @click="drawerOpen = !drawerOpen"
      >
        <svg class="navigation-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </v-btn>
      <v-app-bar-title class="portal-brand">
        <span class="portal-brand-content">
          <span class="portal-brand-mark" aria-hidden="true">{{ brandInitial }}</span>
          <span>{{ displayName }}</span>
          <span v-if="identity" class="portal-brand-context">Management</span>
        </span>
      </v-app-bar-title>
      <v-spacer />
      <div v-if="isDevMode" class="dev-preview-watermark" aria-label="Development preview mode">
        DEV PREVIEW
      </div>
      <v-menu v-if="identity && isDevMode" location="bottom end">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            class="dev-preview-user-button mr-2"
            variant="outlined"
            :aria-label="`${t('devPreview.previewAs')}: ${identity.name}`"
            :title="`${t('devPreview.previewAs')}: ${identity.name}`"
          >
            <svg class="preview-user-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M4.5 20c.7-4 3.3-6 7.5-6s6.8 2 7.5 6" />
            </svg>
            <span class="dev-preview-user-name">{{ identity.name }}</span>
            <v-chip
              v-if="identity.is_system_super_admin"
              class="dev-preview-admin-chip"
              size="x-small"
              color="warning"
              variant="tonal"
            >
              {{ t('devPreview.systemSuperAdmin') }}
            </v-chip>
          </v-btn>
        </template>
        <v-list density="compact" min-width="280">
          <v-list-subheader>{{ t('devPreview.previewAs') }}</v-list-subheader>
          <v-list-item
            v-for="user in previewUserItems"
            :key="user.id"
            :active="identity.id === user.id"
            :title="user.name"
            @click="setPreviewUser(user.id)"
          >
            <template #append>
              <v-chip
                v-if="user.is_system_super_admin"
                size="x-small"
                color="warning"
                variant="tonal"
              >
                {{ t('devPreview.systemSuperAdmin') }}
              </v-chip>
            </template>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>

    <v-navigation-drawer
      v-if="identity"
      :model-value="drawerOpen"
      :permanent="!mobile && drawerOpen"
      :temporary="mobile || !drawerOpen"
      width="256"
      @update:model-value="drawerOpen = $event"
    >
      <div class="portal-nav-heading">
        <div class="portal-nav-eyebrow">{{ t('management.navWorkspace') }}</div>
        <div class="portal-nav-title">{{ t('management.title') }}</div>
      </div>
      <v-list nav density="comfortable" class="portal-nav-list">
        <v-list-item
          v-for="section in sections"
          :key="section"
          class="portal-nav-item"
          :active="activeSection === section"
          :title="t(`management.sections.${section}`)"
          @click="openSection(section)"
        >
          <template #prepend>
            <svg class="portal-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path :d="sectionIcons[section]" />
            </svg>
          </template>
        </v-list-item>
      </v-list>
      <template #append>
        <v-menu open-on-hover location="top end" :close-on-content-click="false">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              class="portal-account-card"
              variant="text"
              :aria-label="t('management.accountActions')"
            >
              <span class="portal-account-avatar" aria-hidden="true">{{ (identity.name || identity.username || 'P').charAt(0).toUpperCase() }}</span>
              <span class="portal-account-details">
                <span class="portal-account-name">{{ identity.name || identity.username || identity.email || identity.id }}</span>
                <span class="portal-account-caption">{{ identity.is_system_super_admin ? t('devPreview.systemSuperAdmin') : t('management.accountLabel') }}</span>
              </span>
              <svg class="portal-account-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5-5 5 5" /></svg>
            </v-btn>
          </template>
          <v-card class="portal-account-menu" min-width="244" variant="elevated">
            <v-card-subtitle class="portal-account-menu-heading">{{ t('management.accountLabel') }}</v-card-subtitle>
            <v-menu location="end top" :close-on-content-click="true">
              <template #activator="{ props }">
                <v-btn v-bind="props" class="portal-account-action" block variant="text" :aria-label="`${t('settings.locale')}: ${selectedLocale.label}`">
                  <span class="locale-flag-circle portal-menu-flag" aria-hidden="true">{{ selectedLocale.flag }}</span>
                  <span class="portal-account-action-label">{{ t('settings.locale') }}</span>
                  <span class="portal-account-action-value">{{ selectedLocale.label }}</span>
                  <span class="portal-account-action-chevron" aria-hidden="true">›</span>
                </v-btn>
              </template>
              <v-list density="compact" class="portal-locale-list">
                <v-list-item
                  v-for="option in localeOptions"
                  :key="option.code"
                  :active="locale === option.code"
                  :title="option.label"
                  @click="setLocale(option.code)"
                >
                  <template #prepend><span class="locale-flag-circle mr-3" aria-hidden="true">{{ option.flag }}</span></template>
                </v-list-item>
              </v-list>
            </v-menu>
            <v-btn
              class="portal-account-action"
              block
              variant="text"
              :aria-label="t(isDark ? 'settings.switchToLight' : 'settings.switchToDark')"
              @click="toggleDarkMode"
            >
              <svg v-if="isDark" class="theme-icon portal-menu-theme-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.2 15.1A8.5 8.5 0 0 1 8.9 3.8 8.6 8.6 0 1 0 20.2 15.1Z" />
                <path d="M17.5 3.5v3M16 5h3M21 8.5v2M20 9.5h2" />
              </svg>
              <svg v-else class="theme-icon portal-menu-theme-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
              </svg>
              <span class="portal-account-action-label">{{ t(isDark ? 'settings.switchToLight' : 'settings.switchToDark') }}</span>
            </v-btn>
            <v-btn
              v-if="accountEditUrl"
              class="portal-account-action"
              block
              variant="text"
              :href="accountEditUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg class="portal-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></svg>
              <span class="portal-account-action-label">{{ t('management.editAccount') }}</span>
              <svg class="portal-external-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9" /></svg>
            </v-btn>
            <v-divider class="my-2" />
            <v-btn class="portal-account-action portal-sign-out-action" block variant="text" @click="signOut">
              <svg class="portal-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3m9-8h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7" /></svg>
              <span class="portal-account-action-label">{{ t('management.signOut') }}</span>
            </v-btn>
          </v-card>
        </v-menu>
      </template>
    </v-navigation-drawer>

    <v-main class="portal-main">
      <v-container v-if="isLoading" class="auth-state d-flex align-center justify-center">
        <v-progress-linear indeterminate color="primary" />
      </v-container>

      <v-container v-else-if="!identity" class="auth-state d-flex align-center justify-center">
        <v-card class="auth-card pa-5 pa-md-9" max-width="480" variant="outlined">
          <div class="signin-mark" aria-hidden="true"><span class="portal-brand-mark">P</span></div>
          <div class="welcome-eyebrow mb-2">{{ t('management.workspaceEyebrow') }}</div>
          <v-card-title class="text-h4 font-weight-bold px-0">
            {{ t('management.signInTitle') }}
          </v-card-title>
          <v-card-text class="px-0 text-body-1 text-medium-emphasis">
            {{ isDevMode ? t('devPreview.signInDescription') : t('management.signInDescription') }}
          </v-card-text>
          <v-alert v-if="authError" class="mb-5" type="error" variant="tonal">
            {{ authError }}
          </v-alert>
          <v-select
            v-if="isDevMode"
            v-model="selectedPreviewUserId"
            class="mb-3"
            :items="previewUserItems"
            :label="t('devPreview.previewAs')"
            item-title="title"
            item-value="value"
            hide-details
          />
          <v-btn block color="primary" size="large" :disabled="isDevMode && !selectedPreviewUserId" @click="signIn">
            {{ t('management.signIn') }}
          </v-btn>
        </v-card>
      </v-container>

      <v-container v-else fluid class="portal-content pa-5 pa-md-9">
        <header v-if="activeSection !== 'overview'" class="page-heading">
          <div class="page-heading-copy">
            <div class="page-heading-eyebrow">{{ t('management.workspaceEyebrow') }}</div>
            <h1 class="text-h4 font-weight-bold mb-0">{{ t(`management.sections.${activeSection}`) }}</h1>
          </div>
        </header>

        <template v-if="activeSection === 'overview'">
          <section class="overview-welcome mb-8">
            <div>
              <div class="welcome-eyebrow">{{ t('management.workspaceEyebrow') }}</div>
              <h2 class="welcome-title">{{ t('management.welcome', { name: identity.name || identity.username || '' }) }}</h2>
              <p class="welcome-description">{{ t('management.pages.overview') }}</p>
            </div>
            <div class="welcome-mark" aria-hidden="true">
              <svg viewBox="0 0 96 96"><path d="M12 43 48 13l36 30v39H57V57H39v25H12z"/><path d="M31 30h34"/></svg>
            </div>
          </section>
          <div class="section-grid-label">{{ t('management.workspaceSections') }}</div>
          <v-row class="workspace-grid">
            <v-col v-for="section in ['entities', 'sites', 'repeaters']" :key="section" cols="12" md="4">
              <v-card
                class="h-100 section-card workspace-card"
                variant="outlined"
                @click="openSection(section)"
              >
                <v-card-item>
                  <template #prepend>
                    <div class="workspace-card-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path :d="sectionIcons[section]" /></svg>
                    </div>
                  </template>
                  <template #append><span class="workspace-card-arrow" aria-hidden="true">↗</span></template>
                  <v-card-title>{{ t(`management.sections.${section}`) }}</v-card-title>
                  <div class="workspace-card-description">{{ t(`management.pages.${section}`) }}</div>
                </v-card-item>
              </v-card>
            </v-col>
          </v-row>
        </template>

        <SitesView v-else-if="activeSection === 'sites'" :key="`sites-${previewUserVersion}`" :api-fetch="auth.apiFetch" :user-subject="identity.id" :is-system-super-admin="identity.is_system_super_admin" />

        <RepeatersView v-else-if="activeSection === 'repeaters'" :key="`repeaters-${previewUserVersion}`" :api-fetch="auth.apiFetch" :user-subject="identity.id" :is-system-super-admin="identity.is_system_super_admin" />

        <EntitiesView
          v-else-if="activeSection === 'entities'"
          :key="`entities-${previewUserVersion}`"
          :api-fetch="auth.apiFetch"
          :can-manage-site-limits="identity.is_system_super_admin"
          :user-subject="identity.id"
          :is-system-super-admin="identity.is_system_super_admin"
        />

        <template v-else-if="activeSection === 'profile'">
          <p class="text-body-1 text-medium-emphasis mb-6">{{ t('management.pages.profile') }}</p>
          <v-card max-width="720" rounded="xl" variant="outlined">
            <v-list lines="two">
              <v-list-item :title="t('management.profileName')" :subtitle="identity.name || '—'" />
              <v-list-item :title="t('management.profileUsername')" :subtitle="identity.username || '—'" />
              <v-list-item :title="t('management.profileEmail')" :subtitle="identity.email || '—'" />
              <v-list-item :title="t('management.profileId')" :subtitle="identity.id" />
            </v-list>
          </v-card>
        </template>

        <template v-else>
          <p class="text-body-1 text-medium-emphasis mb-6">
            {{ t(`management.pages.${activeSection}`) }}
          </p>
          <v-card class="empty-state" max-width="760" rounded="xl" variant="outlined">
            <v-card-text class="pa-6">
              <div class="text-h6 mb-2">{{ t(`management.emptyTitles.${activeSection}`) }}</div>
              <div class="text-body-2 text-medium-emphasis">
                {{ t('management.dataNotConnected') }}
              </div>
            </v-card-text>
          </v-card>
        </template>
      </v-container>
    </v-main>

  </v-app>
</template>

<style scoped>
.portal-main {
  min-height: 100vh;
  background: rgb(var(--v-theme-background));
}

.auth-state {
  min-height: calc(100vh - 64px);
}

.auth-card {
  width: 100%;
  background: rgb(var(--v-theme-surface));
}

.dev-preview-watermark {
  flex: 0 0 auto;
  margin-right: 0.5rem;
  padding: 0.25rem 0.55rem;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.28);
  border-radius: 999px;
  background: rgba(var(--v-theme-surface), 0.78);
  color: rgba(var(--v-theme-on-surface), 0.62);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  pointer-events: none;
  user-select: none;
}

.locale-button {
  flex: 0 0 auto;
}

.locale-flag-circle {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  border-radius: 50%;
  background: rgb(var(--v-theme-surface));
  font-size: 20px;
  line-height: 1;
}

.theme-button {
  flex: 0 0 auto;
}

.dev-mode-button {
  white-space: nowrap;
}

.dev-preview-user-button {
  min-width: 0;
  max-width: 320px;
}

.dev-preview-user-name {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dev-preview-admin-chip {
  min-width: 0;
  max-width: 112px;
  flex: 0 1 auto;
  margin-left: 0.5rem;
  overflow: hidden;
}

.dev-preview-admin-chip :deep(.v-chip__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-user-icon {
  width: 20px;
  height: 20px;
  margin-right: 0.45rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
}

.theme-icon {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

@media (max-width: 600px) {
  .dev-preview-user-button {
    width: 40px;
    min-width: 40px;
    padding: 0;
  }

  .dev-preview-user-name,
  .dev-preview-admin-chip {
    display: none;
  }

  .preview-user-icon {
    margin: 0;
  }
}

.section-card {
  cursor: pointer;
  transition: border-color 120ms ease, transform 120ms ease;
}

.section-card:hover {
  border-color: rgb(var(--v-theme-primary));
  transform: translateY(-2px);
}

.empty-state {
  background: rgb(var(--v-theme-surface));
}

@media (max-width: 600px) {
  .dev-preview-role-select {
    width: 155px;
  }
}
</style>
