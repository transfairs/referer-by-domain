import { debug, info, warn, error } from '../src/lib/logger.js';
import * as debugMode from '../src/lib/debugMode.js';

describe('logger', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('info logs to console.info', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => {});
    info('hello', 1);
    expect(spy).toHaveBeenCalledWith('hello', 1);
  });

  test('error logs to console.error', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    error('oops', 2);
    expect(spy).toHaveBeenCalledWith('oops', 2);
  });

  test('debug does not log when debug mode is disabled', () => {
    const spy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    debug('should not appear');
    expect(spy).not.toHaveBeenCalled();
  });

  test('warn does not log when debug mode is disabled', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    warn('should not appear');
    expect(spy).not.toHaveBeenCalled();
  });

  test('debug logs to console.debug when debug mode is enabled', () => {
    jest.spyOn(debugMode, 'isDebugMode').mockReturnValue(true);
    const spy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    debug('should appear');
    expect(spy).toHaveBeenCalledWith('should appear');
  });

  test('warn logs to console.warn when debug mode is enabled', () => {
    jest.spyOn(debugMode, 'isDebugMode').mockReturnValue(true);
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    warn('should appear');
    expect(spy).toHaveBeenCalledWith('should appear');
  });
});
