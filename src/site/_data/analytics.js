require('dotenv').config();

module.exports = () => {
  const measurementId = (process.env.GA_MEASUREMENT_ID || '').trim();
  if (measurementId && !/^G-[A-Z0-9]+$/.test(measurementId)) {
    throw new Error('GA_MEASUREMENT_ID must be a GA4 measurement ID beginning with G-');
  }
  return {
    measurementId: process.env.ELEVENTY_ENV === 'prod' ? measurementId : '',
  };
};
