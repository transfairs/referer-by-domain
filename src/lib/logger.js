import { isDebugMode } from './debugMode.js';

/**
 * Outputs debug messages to the console if debug mode is enabled.
 * @param  {...any} args - Arguments to pass to console.debug.
 */
export function debug(...args) {
    if (isDebugMode()) {
        console.debug(...args);
    }
}

/**
 * Outputs info messages to the console
 * @param  {...any} args - Arguments to pass to console.info.
 */
export function info(...args) {
    console.info(...args);
}

/**
 * Outputs warning messages to the console if debug mode is enabled.
 * @param  {...any} args - Arguments to pass to console.warn.
 */
export function warn(...args) {
    if (isDebugMode()) {
        console.warn(...args);
    }
}

/**
 * Outputs error messages to the console
 * @param  {...any} args - Arguments to pass to console.warn.
 */
export function error(...args) {
    console.error(...args);
}
