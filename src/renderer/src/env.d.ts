import { UniboxApi } from '../../preload'

declare global {
  interface Window {
    unibox: UniboxApi
  }
}
