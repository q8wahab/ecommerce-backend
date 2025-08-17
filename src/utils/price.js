// Convert KWD to fils (1 KWD = 1000 fils)
const toFils = (kwd) => {
  return Math.round(parseFloat(kwd) * 1000);
};

// Convert fils to KWD
const fromFils = (fils) => {
  return (parseInt(fils) / 1000).toFixed(3);
};

module.exports = {
  toFils,
  fromFils
};

