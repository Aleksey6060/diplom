// University-scoped version — re-exports the global AdminUniversity
// Both global and university admin use the same component since
// university CRUD is always done against the global /api/universities/ endpoint.
export { default } from '../../admin/AdminUniversity'
