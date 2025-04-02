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
  'function isApprovedForAll(address owner, address operator) external view returns (bool)',
  'function uri(uint256) external view returns (string memory)'
]

function App() {
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [escrow, setEscrow] = useState(null)
  const [fireforce, setFireforce] = useState(null)
  const [walletAddress, setWalletAddress] = useState('')
  const [connected, setConnected] = useState(false)
  const [listings, setListings] = useState([])
  const [nftID, setNftID] = useState('1')
  const [nftAmount, setNftAmount] = useState('1')
  const [animePrice, setAnimePrice] = useState('0.01')

  useEffect(() => {
    async function init() {
      if (typeof window.ethereum !== 'undefined') {
        const prov = new ethers.BrowserProvider(window.ethereum)
        const accounts = await window.ethereum.request({ method: 'eth_accounts' })
        if (accounts.length > 0) {
          const signer = await prov.getSigner()
          const userAddress = await signer.getAddress()
          const escrowContract = new ethers.Contract(ESCROW_CONTRACT, escrowAbi, signer)
          const fireforceContract = new ethers.Contract(FIREFORCE_CONTRACT, fireforceAbi, signer)

          setProvider(prov)
          setSigner(signer)
          setWalletAddress(userAddress)
          setEscrow(escrowContract)
          setFireforce(fireforceContract)
          setConnected(true)
        }
      }
    }

    init()
  }, [])

  async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      window.location.reload()
    } else {
      alert('Please install MetaMask to use this app.')
    }
  }

  function disconnectWallet() {
    setWalletAddress('')
    setConnected(false)
    setSigner(null)
    setProvider(null)
    setEscrow(null)
    setFireforce(null)
  }

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

        let uri = await fireforce.uri(e[2])
        const hexId = e[2].toString(16).padStart(64, '0')
        uri = uri.replace('{id}', hexId)
        if (uri.startsWith('ipfs://')) {
          uri = uri.replace('ipfs://', 'https://ipfs.io/ipfs/')
        }

        let image = ''
        try {
          const res = await fetch(uri)
          const json = await res.json()
          image = json.image?.replace('ipfs://', 'https://ipfs.io/ipfs/')
        } catch (err) {
          console.error(`Failed to load metadata for token ${e[2]}`, err)
        }

        all.push({
          index: i,
          seller: e[0],
          tokenID: e[2].toString(),
          amount: e[3].toString(),
          price: ethers.formatEther(e[4]),
          rawPrice: e[4],
          image
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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Marketplace v1</h1>
        {!connected ? (
          <button
            onClick={connectWallet}
            style={{
              backgroundColor: '#111',
              color: 'white',
              padding: '0.4rem 1rem',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Connect Wallet
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', color: '#333' }}>
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
            <button
              onClick={disconnectWallet}
              style={{
                backgroundColor: '#eee',
                border: 'none',
                padding: '0.25rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Listing Form */}
      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ fontWeight: 'bold' }}>Trade your Fire Force Sashimono</h2>
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

      {/* Listings */}
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
            {listing.image && (
              <img
                src={listing.image}
                alt={`Token ${listing.tokenID}`}
                style={{ width: '100%', maxHeight: '250px', objectFit: 'cover', marginBottom: '0.5rem', borderRadius: '8px' }}
              />
            )}
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
