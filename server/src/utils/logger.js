const ts = () => new Date().toISOString();
const fmt = (level, args) => `[${ts()}] ${level} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`;

module.exports = {
  info: (...a) => console.log(fmt('INFO ', a)),
  warn: (...a) => console.warn(fmt('WARN ', a)),
  error: (...a) => console.error(fmt('ERROR', a)),
  debug: (...a) => process.env.DEBUG && console.log(fmt('DEBUG', a)),
};
