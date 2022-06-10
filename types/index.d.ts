export interface LogFacesHTTPAppender {
  type: '@log4js-node/logfaces-http';
  // logFaces receiver servlet URL
  url: string;
  // (defaults to empty string) - used to identify your application’s logs
  application?: string;
  // (defaults to 5000ms) - the timeout for the HTTP request.
  timeout?: number;
  /** logFaces hostname (h) property */
  hostname?: string;
}

// Add the LogFacesHTTPAppender to the list of appenders in log4js for better type support
declare module 'log4js' {
  export interface Appenders {
    LogFacesHTTPAppender: LogFacesHTTPAppender;
  }
}
