import { useEffect, useState } from 'react'
import { ethers } from 'ethers'

const ESCROW_CONTRACT = '0x0896Ec6E48479508FD119C2b3C4A6e93C7b1C8E8'
const FIREFORCE_CONTRACT = '0x87983e46B33783Eea3e51d4ab2fc937Ac73D4290'

const escrowAbi = [
  'function createEscrow(address nftContract, uint256 nftID, uint256 nftAmount, uint256 animeAmountInWei) public',
  'function buyWithAnime(uint256 i) external payable',
  'function getEscrow(uint256 i) public view returns (tuple(address,address,uint256,uint256,uint256))',
  'function removeEscrow(uint256 i) public'
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
  const [walletAddress, setWalletAddress] = useState('')
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
        const userAddress = await signer.getAddress()
        const escrowContract = new ethers.Contract(ESCROW_CONTRACT, escrowAbi, signer)
        const fireforceContract = new ethers.Contract(FIREFORCE_CONTRACT, fireforceAbi, signer)

        setProvider(prov)
        setSigner(signer)
        setWalletAddress(userAddress)
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

  async function cancelEscrow(index) {
    const tx = await escrow.removeEscrow(index)
    await tx.wait()
    fetchListings()
  }

  async function fetchListings() {
    const all = []
    for (let i = 0; i < 20; i++) {
      try {
        const e = await escrow.getEscrow(i)
        if (e[3].toString() === '0') continue
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

      {/* NFT Listing Form */}
      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ fontWeight: 'bold' }}>List Your NFT</h2>
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label>
            NFT ID
            <input
              type="number"
              placeholder="The token ID of your NFT (e.g. 1)"
              value={nftID}
              onChange={e => setNftID(e.target.value)}
            />
          </label>

          <label>
            Amount
            <input
              type="number"
              placeholder="How many copies to list (e.g. 1)"
              value={nftAmount}
              onChange={e => setNftAmount(e.target.value)}
            />
          </label>

          <label>
            Price in ANIME
            <input
              type="text"
              placeholder="Listing price in ANIME (e.g. 0.01)"
              value={animePrice}
              onChange={e => setAnimePrice(e.target.value)}
            />
          </label>

          <button
            style={{
              padding: '0.5rem 1rem',
              marginTop: '1rem',
              fontWeight: 'bold',
              backgroundColor: '#111',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
            onClick={listNFT}
            disabled={!signer || !escrow || !fireforce}
          >
            List NFT
          </button>
        </div>
      </div>

      {/* Active Listings */}
      <div style={{ marginTop: '3rem' }}>
        <h2 style={{ fontWeight: 'bold' }}>Active Listings</h2>

        <button
          onClick={fetchListings}
          style={{
            marginBottom: '1rem',
            padding: '0.25rem 0.75rem',
            background: '#ccc',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🔄 Refresh Listings
        </button>

        {listings.length === 0 && <p>No listings found.</p>}
        {listings.map(listing => (
          <div key={listing.index} style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem' }}>
            <p><strong>NFT ID:</strong> {listing.tokenID}</p>
            <p><strong>Amount:</strong> {listing.amount}</p>
            <p><strong>Price:</strong> {listing.price} ANIME</p>

            <button
              style={{
                padding: '0.5rem 1rem',
                fontWeight: 'bold',
                backgroundColor: '#198754',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
              onClick={() => buy(listing.index, listing.rawPrice)}
            >
              Buy
            </button>

            {listing.seller.toLowerCase() === walletAddress.toLowerCase() && (
              <button
                style={{
                  marginLeft: '0.5rem',
                  padding: '0.5rem 1rem',
                  fontWeight: 'bold',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
                onClick={() => cancelEscrow(listing.index)}
              >
                Cancel
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
