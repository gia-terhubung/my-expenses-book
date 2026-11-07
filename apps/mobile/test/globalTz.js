// Pin the zone for every suite (runs in the parent before workers spawn, so they inherit it).
// Date-sensitive tests then behave the same on any machine; dateString.test.ts needs a DST zone.
module.exports = async () => {
  process.env.TZ = "Europe/Paris";
};
