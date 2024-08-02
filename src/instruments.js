const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");
import environmentVars from './constantsVars';

if(environmentVars.SENTRY_PRODUCTION === 'production'){
    Sentry.init({
  dsn: "https://c3b80e2c88b9bd31a33873699dcc21e5@o4507626764959744.ingest.us.sentry.io/4507706273038336",
  integrations: [
    nodeProfilingIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, //  Capture 100% of the transactions

  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,
});
}