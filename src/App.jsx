import { useEffect, useState } from 'react'
import { ethers } from 'ethers'

// Replace with your actual contract addresses
const ESCROW_CONTRACT = '0x0896Ec6E48479508FD119C2b3C4A6e93C7b1C8E8'
const FIREFORCE_CONTRACT = '0x87983e46B33783Eea3e51d4ab2fc937Ac73D4290'

const escrowAbi = [
  'function createEscrow(address nftContract, uint256 nftID, uint256 nftAmount, uint256 animeAmountInWei) public',
  'function buyWithAnime(uint256 i) external payable',
  'function getEscrow(uint256 i) public view returns (tuple(address,address,uint256,uint256,uint256))'
]

const fireforceAbi = [
  'function setApprovalForAll(address operator, bool approved) external',
  'function isApprovedForAll(address owner, address operator) external view returns (bool)'
]

function App() {
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [escrow, setEscrow] = useState(null)
  const [fireforce, setFireforce] = useState(null)
  const [listings, setListings] = useState([])
  const [nftID, setNftID] = useState('1')
  const [nftAmount, setNftAmount] = useState('1')
  const [animePrice, setAnimePrice] = useState('0.01')

  useEffect(() => {
    async function init() {
      if (typeof window.ethereum !== 'undefined') {
        await window.ethereum.request({ method: 'eth_requestAccounts' })
        const prov = new ethers.BrowserProvider(window.ethereum)
        const signer = await prov.getSigner()
        const escrowContract = new ethers.Contract(ESCROW_CONTRACT, escrowAbi, signer)
        const fireforceContract = new ethers.Contract(FIREFORCE_CONTRACT, fireforceAbi, signer)

        setProvider(prov)
        setSigner(signer)
        setEscrow(escrowContract)
        setFireforce(fireforceContract)
      } else {
        alert('Please install MetaMask to use this app.')
      }
    }

    init()
  }, [])

  async function listNFT() {
    if (!signer || !escrow || !fireforce) {
      alert('App is still initializing. Please wait a moment and try again.')
      return
    }

    const priceInWei = ethers.parseEther(animePrice)
    const owner = await signer.getAddress()
    const approved = await fireforce.isApprovedForAll(owner, ESCROW_CONTRACT)

    if (!approved) {
      const tx = await fireforce.setApprovalForAll(ESCROW_CONTRACT, true)
      await tx.wait()
    }

    const tx = await escrow.createEscrow(FIREFORCE_CONTRACT, nftID, nftAmount, priceInWei)
    await tx.wait()
    fetchListings()
  }

  async function buy(index, priceInWei) {
    if (!escrow) return
    const tx = await escrow.buyWithAnime(index, { value: priceInWei })
    await tx.wait()
    fetchListings()
  }

  async function fetchListings() {
    const all = []
    for (let i = 0; i < 10; i++) {
      try {
        const e = await escrow.getEscrow(i)
        all.push({
          index: i,
          seller: e[0],
          tokenID: e[2].toString(),
          amount: e[3].toString(),
          price: ethers.formatEther(e[4]),
          rawPrice: e[4],
        })
      } catch {
        break
      }
    }
    setListings(all)
  }

  useEffect(() => {
    if (escrow) fetchListings()
  }, [escrow])

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>EscrowFire2 UI</h1>

      <div style={{ marginTop: '2rem' }}>
        <h2>List NFT</h2>
        <input placeholder="NFT ID" value={nftID} onChange={e => setNftID(e.target.value)} />
        <input placeholder="Amount" value={nftAmount} onChange={e => setNftAmount(e.target.value)} />
        <input placeholder="Price in ANIME (e.g. 0.01)" value={animePrice} onChange={e => setAnimePrice(e.target.value)} />
        <button onClick={listNFT} disabled={!signer || !escrow || !fireforce}>
          List NFT
        </button>
      </div>

      <div style={{ marginTop: '3rem' }}>
        <h2>Active Listings</h2>
        {listings.length === 0 && <p>No listings found.</p>}
        {listings.map(listing => (
          <div key={listing.index} style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem' }}>
            <p>NFT ID: {listing.tokenID}</p>
            <p>Amount: {listing.amount}</p>
            <p>Price: {listing.price} ANIME</p>
            <button onClick={() => buy(listing.index, listing.rawPrice)}>Buy</button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
