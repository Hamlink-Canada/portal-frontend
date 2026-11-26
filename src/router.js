import { createRouter, createWebHistory } from 'vue-router'
import { getUnsavedChangesMessage } from './utils/unsavedChanges.js'

// App.vue renders the active section from the route name. These route anchors
// keep Vue Router's records valid without adding a second content renderer.
const routeAnchor = { render: () => null }

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'overview', component: routeAnchor, meta: { section: 'overview' } },
    { path: '/sites', name: 'sites', component: routeAnchor, meta: { section: 'sites' } },
    { path: '/sites/new', name: 'site-create', component: routeAnchor, meta: { section: 'sites', formPage: true } },
    { path: '/sites/:id', name: 'site-detail', component: routeAnchor, meta: { section: 'sites', detailPage: true } },
    { path: '/sites/:id/edit', name: 'site-edit', component: routeAnchor, meta: { section: 'sites', formPage: true } },
    { path: '/repeaters', name: 'repeaters', component: routeAnchor, meta: { section: 'repeaters' } },
    { path: '/repeaters/new', name: 'repeater-create', component: routeAnchor, meta: { section: 'repeaters', formPage: true } },
    { path: '/repeaters/:nodeId', name: 'repeater-detail', component: routeAnchor, meta: { section: 'repeaters', detailPage: true } },
    { path: '/repeaters/:nodeId/edit', name: 'repeater-edit', component: routeAnchor, meta: { section: 'repeaters', formPage: true } },
    { path: '/entities', name: 'entities', component: routeAnchor, meta: { section: 'entities' } },
    { path: '/entities/new', name: 'entity-create', component: routeAnchor, meta: { section: 'entities', formPage: true } },
    { path: '/entities/:id', name: 'entity-detail', component: routeAnchor, meta: { section: 'entities', detailPage: true } },
    { path: '/entities/:id/edit', name: 'entity-edit', component: routeAnchor, meta: { section: 'entities', formPage: true } },
    { path: '/profile', name: 'profile', component: routeAnchor, meta: { section: 'profile' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(() => {
  const message = getUnsavedChangesMessage()
  return !message || window.confirm(message)
})

export default router
