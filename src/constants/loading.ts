const location = window.location.toString().replace(/[^/]*$/gu, "");

const scriptLocation =
  document
    .querySelector('script[src$="app.js"]')
    ?.getAttribute("src")
    ?.replace("app.js", "") ?? "";

export const baseURL = `${location}${scriptLocation}`;
console.log("Location" + location)
console.log("scriptLocation" + scriptLocation)
console.log("baseURL" + baseURL)