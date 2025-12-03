const { ethers } = require("ethers");
const { AIEP, Permissions } = require("../sdk/aiep");

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const [owner, signer, other] = await Promise.all([
    provider.getSigner(0),
    provider.getSigner(1),
    provider.getSigner(2)
  ]);
  const contractAddress = process.env.AIEP_CONTRACT;
  const aiepOwner = new AIEP(owner, contractAddress);
  const aiepProvider = new AIEP(provider, contractAddress);

  const key = ethers.keccak256(ethers.toUtf8Bytes("auth-key"));
  await aiepOwner.setAgentSigner(await signer.getAddress());
  await aiepOwner.createAuthorizedKey(key, 0, Permissions.READ | Permissions.WRITE);
  const ok = await aiepProvider.verifyAuthorizedKey(key, Permissions.READ);
  if (!ok) throw new Error("verify failed");

  const now = Math.floor(Date.now() / 1000);
  await aiepOwner.depositToAgent(ethers.parseEther("1"));
  await aiepProvider.delegatedPayEth(await other.getAddress(), ethers.parseEther("0.1"), now + 3600, signer);
}

main().catch(console.error);
