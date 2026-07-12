const minimumNodeVersion = [20, 19, 0];
const maximumNodeVersion = [21, 0, 0];

function parseVersion(version) {
  return version.split(".").map((segment) => Number.parseInt(segment, 10));
}

function compareVersions(left, right) {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    if (leftValue < rightValue) return -1;
    if (leftValue > rightValue) return 1;
  }
  return 0;
}

const currentNodeVersion = parseVersion(process.versions.node);
const isSupported =
  compareVersions(currentNodeVersion, minimumNodeVersion) >= 0 &&
  compareVersions(currentNodeVersion, maximumNodeVersion) < 0;

if (!isSupported) {
  console.error(
    [
      `Unsupported Node.js version: ${process.versions.node}`,
      "This project requires Node.js >=20.19.0 and <21.",
      "Pinned version for this repository: 20.20.1.",
      "Recommended fix:",
      "  volta install node@20.20.1",
      "  npm install",
    ].join("\n")
  );
  process.exit(1);
}
