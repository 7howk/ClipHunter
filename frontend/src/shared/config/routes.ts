export const routes = {
  home: '/',
  upload: '/upload',
  project: (id: string) => `/projects/${encodeURIComponent(id)}`,
  projectPattern: '/projects/:projectId',
} as const;

/** Якоря секций лендинга, на которые ссылается шапка. */
export const landingAnchors = {
  how: 'how',
  result: 'result',
  principles: 'principles',
} as const;
