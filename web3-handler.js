let provider, signer, contract;

// --- CONFIGURATION ---
const CONTRACT_ADDRESS = "0x0f4de68eC097d17f624b764EdDBddA1fbEcE254C"; 
const BLX_TOKEN_ADDRESS = "0x3B66b1E08F55AF26c8eA14a73dA64b6bC8D799dE"; // BSC USDT
const TESTNET_CHAIN_ID = 97; 

// --- RANK CONFIG (Star1 to Master King) ---
const RANK_DETAILS = [
     { name: "None", count: 0, vol: 0 },
            { name: "Star", count: 10, vol: 1000 },
            { name: "Silver", count: 50, vol: 5000 },
            { name: "Gold", count: 100, vol: 20000 },
            { name: "Platinum", count: 300, vol: 50000 },
            { name: "Diamond", count: 1000, vol: 100000 },
            { name: "D. Diamond", count: 3000, vol: 1500000 },
            { name: "C. Diamond", count: 5000, vol: 2000000 }
];

const CONTRACT_ABI = [
    // --- View Functions ---
    "function getUserDetails(address wallet) external view returns (uint256, address, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256)",
    "function userBonusUSDTWallet(address) external view returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256)",
    "function globalOrbitPurchaseDetails(address wallet) external view returns (bool[10], uint256[10], uint, uint)",
    "function reward_details(address wallet) public view returns (uint256[], uint256[], uint8[], address[], uint8[], uint8[])",
    "function getPlatformStats() public view returns (uint256, uint256, uint256)",
    "function getTodayBonusSummary(address wallet) public view returns (uint, uint256, uint256, uint256, uint256, uint256)",
    "function getUserActiveOrbitSlotRecycle(address user, uint slot) public view returns (uint256)",
    "function getActiveOrbitVacentSlot(address wallet, uint packageId) public view returns (uint, uint)",
    "function getWorkingTree(address user, uint slot) external view returns (address[])",
    "function getFetchLevel(address user, uint slot, uint8 level) external view returns (address[])",
    "function getActiveSlotFrom(address user, uint slot, uint cycle) external view returns (address[])",
    "function getActiveSlotTimestamps(address user) external view returns (uint256[])",
    "function getPassiveSlotFromTimeStamps(address user) external view returns (uint256[])",
    "function getUsersByPackageId(uint packageId) external view returns (address[])",
    "function getAllUserCount() public view returns (uint256)",
    "function getTotalPassiveCycles(address wallet, uint8 packageId) public view returns (uint256)",
    "function getPassiveCyclePositions(address wallet, uint8 packageId) public view returns (uint256[])",
    "function getPassiveCycleData(address wallet, uint8 packageId, uint256 cycleNo) public view returns (uint256, uint256, bool, bool)",
    "function getPassiveCycleUsers(uint8 packageId, uint256 start, uint256 end) public view returns (address[])",
    "function userExists(address user) public view returns (bool)",
    "function owner() public view returns (address)",
    // --- Write Functions ---
    "function register(address referrer) external",
    "function reTopup(uint8[] calldata packageId) external",
    "function takeOut(uint256 takeOutAmount) external",
    "function enrollRegister(address wallet, address referrer) external",
    "function enrollReTopup(address wallet, uint8[] calldata packageId) external",
    "function Process(address[] calldata wallet, uint256 amount, uint8 mode) external",
    "function distributeBonus(tuple(address user, uint8 packageId)[] calldata wallet, uint256 amount, uint8 packageid) external",
    "function distributeIncomeBatch(uint8 packageId, uint256 amountPerUser, uint256 startIndex, uint256 endIndex) external",
    "function assestsAllocation(address tokencontract, address _wallet, uint _amount) external returns(bool)",
    "function updateBonusWallet(address user, uint256 passiveOrbitBonus, uint256 totalCreditedBonus, uint256 totalSkippedBonus) external"
];
const ERC20_ABI = ["function approve(address spender, uint256 amount) public returns (bool)", "function allowance(address owner, address spender) public view returns (uint256)"];

const calculateGlobalROI = () => 0.90;

// --- 1. AUTO-FILL LOGIC ---
async function checkReferralURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const refParam = urlParams.get('ref'); 
    const refField = document.getElementById('reg-referrer');
    
    if (refParam && refField) {
        if (ethers.utils.isAddress(refParam)) {
            refField.value = refParam.trim();
        } else {
            try {
                const address = await contract.usernameToAddress(refParam);
                refField.value = address;
            } catch (e) {
                console.log("Username not found, using as is:", refParam);
                refField.value = refParam.trim();
            }
        }
        console.log("Referral processed:", refField.value);
    }
}

async function init() {
    checkReferralURL();

    try {
        if (window.ethereum) {
            provider = new ethers.providers.Web3Provider(window.ethereum, "any");
            
            // --- AUTO NETWORK SWITCH LOGIC ---
            const network = await provider.getNetwork();
            if (network.chainId !== TESTNET_CHAIN_ID) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: '0x61' }], // 97 = 0x61
                    });
                    window.location.reload();
                    return; 
                } catch (switchError) {
                    console.warn("User denied network switch or network not added.");
                }
            }

            // Read-only contract instance
            contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
            window.contract = contract;

            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                signer = provider.getSigner();
                window.signer = signer; // <--- Yeh line zaroori hai
                
                // Signer ke sath contract instance
                contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
                window.contract = contract; // <--- Global contract update
                
                await setupApp(accounts[0]);
            }

            // Listeners
            window.ethereum.on('chainChanged', () => window.location.reload());
            window.ethereum.on('accountsChanged', (accs) => {
                if (accs.length === 0) localStorage.removeItem('userAddress');
                else localStorage.setItem('userAddress', accs[0]);
                window.location.reload();
            });
        }
    } catch (error) {
        console.error("Init Error:", error);
    }
}
// --- CORE LOGIC ---
window.handleDeposit = async function(withBurn) {
    const amountInput = document.getElementById('deposit-amount');
    const depositBtn = event.target; // Jo button click hua hai
    
    if (!amountInput || !amountInput.value || parseFloat(amountInput.value) < 100) {
        return alert("Min 100 BLX required!");
    }

    try {
        let activeSigner = window.signer || provider.getSigner();
        let activeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, activeSigner);

        depositBtn.disabled = true;
        depositBtn.innerText = "APPROVING...";

        const amountInWei = ethers.utils.parseUnits(amountInput.value.toString(), 18);
        const blxToken = new ethers.Contract(BLX_TOKEN_ADDRESS, ERC20_ABI, activeSigner);

        // 1. Approval Step
        const allowance = await blxToken.allowance(await activeSigner.getAddress(), CONTRACT_ADDRESS);
        if (allowance.lt(amountInWei)) {
            const approveTx = await blxToken.approve(CONTRACT_ADDRESS, amountInWei);
            await approveTx.wait();
        }

        depositBtn.innerText = "SIGNING...";

        // 2. Stake Step: yahan 'withBurn' dynamic parameter use ho raha hai
        // stake(uint256 amount, bool withBurn)
        const depositGas = await activeContract.estimateGas.stake(amountInWei, withBurn);
        const tx = await activeContract.stake(amountInWei, withBurn, { 
            gasLimit: depositGas.mul(150).div(100) 
        });
        
        depositBtn.innerText = withBurn ? "BURNING & STAKING..." : "STAKING...";
        await tx.wait();
        
        alert(withBurn ? "Stake with Burn Successful!" : "Stake Successful!");
        location.reload(); 
    } catch (err) {
        console.error("Deposit Error:", err);
        alert("Error: " + (err.data?.message || err.message || "Transaction Failed"));
        depositBtn.innerText = withBurn ? "STAKE WITH BURN" : "STAKE WITHOUT BURN";
        depositBtn.disabled = false;
    }
}
window.handleUpgrade = async function(packageIds) {
    try {
        if (!window.contract || !window.signer) return alert("Wallet not connected!");

        const btn = event.target;
        btn.disabled = true;
        btn.innerText = "APPROVING...";

        // 1. पैकेज प्राइस निकालें (इंडेक्स 0 मतलब पहला पैकेज)
        // ध्यान दें: आपके HTML में index 0 से 9 है
        const pid = packageIds[0];
        const price = [21, 42, 84, 168, 336, 672, 1344, 2688, 5376, 10752][pid];
        const amountInWei = ethers.utils.parseEther(price.toString());

        // 2. USDT कॉन्ट्रैक्ट के साथ अप्रूवल
        const usdtContract = new ethers.Contract(BLX_TOKEN_ADDRESS, ERC20_ABI, window.signer);
        
        // पहले चेक करें कि क्या पर्याप्त allowance है
        const allowance = await usdtContract.allowance(await window.signer.getAddress(), CONTRACT_ADDRESS);
        
        if (allowance.lt(amountInWei)) {
            const approveTx = await usdtContract.approve(CONTRACT_ADDRESS, amountInWei);
            btn.innerText = "WAITING FOR APPROVAL...";
            await approveTx.wait();
        }

        // 3. अब reTopup कॉल करें
        btn.innerText = "UPGRADING...";
        const estimatedGas = await window.contract.estimateGas.reTopup(packageIds);
        const gasLimit = estimatedGas.mul(130).div(100);

        const tx = await window.contract.reTopup(packageIds, { gasLimit: gasLimit });
        await tx.wait();

        alert("Package Upgraded Successfully!");
        location.reload(); 
        
    } catch (err) {
        console.error("Upgrade Error:", err);
        alert("Upgrade failed: " + (err.reason || err.message));
        event.target.disabled = false;
        event.target.innerText = "UPGRADE";
    }
}
window.handleClaimROI = async function(stakeIndex = 0) {
    const claimBtn = event.target;
    try {
        claimBtn.disabled = true; claimBtn.innerText = "CLAIMING...";
        const activeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider.getSigner());
        const tx = await activeContract.claimROI(stakeIndex);
        await tx.wait();
        alert("ROI Claimed Successfully!");
        location.reload(); 
    } catch (err) {
        alert("Claim failed: " + (err.reason || err.message));
        claimBtn.disabled = false; claimBtn.innerText = "CLAIM ROI";
    }
}
window.handleRequestUnstake = async function(stakeIndex = 0) {
    try {
        const activeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider.getSigner());
        const tx = await activeContract.requestUnstake(stakeIndex);
        await tx.wait();
        alert("Unstake Requested! Wait 14 days to claim.");
    } catch (err) { alert("Error: " + err.message); }
}
window.handleWithdraw = async function() {
    // 1. सही ID (takeoutInput) का उपयोग करें
    const amountInput = document.getElementById('takeoutInput');
    const amount = amountInput.value;
    
    if (!amount || amount <= 0) return alert("Enter valid amount");
    
    try {
        const btn = event.target;
        btn.disabled = true;
        btn.innerText = "PROCESSING...";

        // 2. 18 डेसिमल्स के साथ अमाउंट कन्वर्ट करें
        const amountInWei = ethers.utils.parseUnits(amount.toString(), 18);
        
        // 3. गैस एस्टिमेशन (30% बफर के साथ)
        const estimatedGas = await window.contract.estimateGas.takeOut(amountInWei);
        const gasLimit = estimatedGas.mul(130).div(100);

        // 4. कॉन्ट्रैक्ट का सही फंक्शन नाम 'takeOut' का उपयोग करें
        const tx = await window.contract.takeOut(amountInWei, { 
            gasLimit: gasLimit 
        });

        await tx.wait();
        alert("Withdrawal Successful!");
        location.reload();
        
    } catch (err) { 
        console.error("Withdraw Error:", err);
        alert("Withdraw Error: " + (err.reason || err.message));
        event.target.disabled = false;
        event.target.innerText = "PROCESS TAKEOUT";
    }
}
window.handleClaimUnstake = async function(stakeIndex = 0) {
    try {
        const activeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider.getSigner());
        const tx = await activeContract.claimUnstake(stakeIndex);
        await tx.wait();
        alert("Capital Claimed!");
        location.reload();
    } catch (err) { alert("Error: " + err.message); }
}


window.handleCompoundDaily = async function() {
    const compoundBtn = event.target;
    const originalText = compoundBtn.innerText;
    try {
        compoundBtn.disabled = true; compoundBtn.innerText = "WAITING...";
        const tx = await contract.reinvestMatured();
        compoundBtn.innerText = "REINVESTING...";
        await tx.wait();
        alert("Reinvestment Successful!");
        location.reload(); 
    } catch (err) {
        alert("Reinvest failed: " + (err.reason || err.message));
        compoundBtn.innerText = originalText; compoundBtn.disabled = false;
    }
}


window.handleLogin = async function() {
    try {
        if (!window.ethereum) return alert("Please install Trust Wallet or MetaMask!");
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        // कॉन्ट्रैक्ट से डेटा फेच करें
        const userData = await contract.getUserDetails(accounts[0]);
        
        // कॉन्ट्रैक्ट के अनुसार यदि userId (index 0) 0 नहीं है, तो यूजर रजिस्टर्ड है
        const isRegistered = userData[0].toString() !== "0";
        
        if (isRegistered) { 
            localStorage.setItem('userAddress', accounts[0]); 
            window.location.href = "index1.html"; 
        } else { 
            alert("Not registered!"); 
            window.location.href = "register.html"; 
        }
    } catch (err) { 
        console.error("Login Error:", err); 
        alert("Login Error: " + err.message);
    }
}
window.handleRegister = async function() {
    const refField = document.getElementById('reg-referrer');
    const regBtn = event.target;
    if (!refField || !ethers.utils.isAddress(refField.value.trim())) return alert("Valid Referrer Address is required!");
    try {
        regBtn.disabled = true; regBtn.innerText = "REGISTERING...";
        const tx = await contract.register(refField.value.trim(), { gasLimit: 300000 });
        await tx.wait();
        localStorage.setItem('userAddress', await signer.getAddress());
        alert("Registration Successful!");
        window.location.href = "index1.html";
    } catch (err) { alert("Error: " + (err.reason || "Registration failed.")); regBtn.disabled = false; }
}

window.handleLogout = function() {
    if (confirm("Disconnect and Logout?")) { localStorage.clear(); window.location.href = "index.html"; }
}

function updateNavbar(address) {
    const navAddr = document.getElementById('connect-btn');
    if(navAddr) navAddr.innerText = address.substring(0, 6) + "..." + address.substring(38);
}


function showLogoutIcon(address) {
    const btn = document.getElementById('connect-btn');
    const logout = document.getElementById('logout-icon-btn');
    if (btn) btn.innerText = address.substring(0, 6) + "..." + address.substring(38);
    if (logout) logout.style.display = 'flex'; 
}

async function setupApp(address) {
    if (!address) return;
    localStorage.setItem('userAddress', address);

    // 1. नेटवर्क चेक और ऑटो-स्विचिंग
    try {
        const network = await provider.getNetwork();
        if (network.chainId !== TESTNET_CHAIN_ID) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x61' }], // 97 = 0x61
                });
                window.location.reload(); // स्विच होने के बाद रीलोड
                return;
            } catch (switchError) {
                if (switchError.code === 4902) {
                    alert("Please add BSC Testnet to your wallet.");
                } else {
                    alert("Please switch to BSC Testnet manually.");
                }
            }
        }
    } catch (err) {
        console.error("Network check failed:", err);
    }

    // --- NEW: UI Update Logic (Referral & Address) ---
    const addrDisplay = document.getElementById('user-address');
    if(addrDisplay) addrDisplay.innerText = address.substring(0, 6) + "..." + address.substring(38);
    
    const refInput = document.getElementById('refURL');
    if(refInput) refInput.value = `${window.location.origin}/register.html?ref=${address}`;

    // 2. कॉन्ट्रैक्ट डेटा और रिडायरेक्शन लॉजिक
    // यहाँ हमने contract.users के बजाय getUserDetails का उपयोग किया है
    let userExists = false;
    try {
        const userData = await contract.getUserDetails(address);
        // अगर userId (पहली वैल्यू) 0 से बड़ी है, तो यूजर मौजूद है
        userExists = userData[0].toString() !== "0";
    } catch (e) {
        console.error("User check error:", e);
    }

    const path = window.location.pathname;
    console.log("User Exists in Contract:", userExists);

    if (!userExists && !path.includes('register.html')) {
        window.location.href = "register.html";
        return;
    } else if (userExists && path.includes('register.html')) {
        window.location.href = "index1.html";
        return;
    }

    updateNavbar(address);
    showLogoutIcon(address);
    if (path.includes('index1.html')) fetchAllData(address);
}
window.fetchBlockchainHistory = async function(categories) {
    try {
        const address = await window.signer.getAddress();
        const finalLogs = [];

        // 1. STAKE DATA (Name check: 'DEPOSIT' हटाकर 'STAKE' किया)
        if (categories.includes('STAKE')) { 
            const count = await window.contract.getStakeCount(address);
            console.log("Total Stakes found:", count.toString());

            for (let i = 0; i < count; i++) {
                const s = await window.contract.getStake(address, i);
                
                // डेटा मैपिंग - कॉन्ट्रैक्ट के अनुसार
                const amount = s.amount !== undefined ? s.amount : s[0];
                const startTime = s.startTime !== undefined ? s.startTime : s[1];
                const withBurn = s.withBurn !== undefined ? s.withBurn : s[4];

                if (amount) {
                    finalLogs.push({
                        type: 'STAKE', // UI में भी 'STAKE' दिखेगा
                        amount: parseFloat(ethers.utils.formatUnits(amount.toString(), 18)).toFixed(2),
                        date: new Date(startTime * 1000).toLocaleDateString(),
                        time: new Date(startTime * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
                        detail: withBurn ? "With Burn" : "Standard"
                    });
                }
            }
        }

        // 2. INCOME DATA (नाम चेक)
        const incomeLogs = await window.contract.getIncomeHistory(address);
        if (incomeLogs && incomeLogs.length > 0) {
            incomeLogs.forEach(item => {
                const incomeType = item.incomeType || item[0];
                const amount = item.amount || item[1];
                const timestamp = item.timestamp || item[2];

                if (categories.includes(incomeType.toUpperCase())) {
                    finalLogs.push({
                        type: incomeType.toUpperCase(),
                        amount: parseFloat(ethers.utils.formatUnits(amount.toString(), 18)).toFixed(2),
                        date: new Date(timestamp * 1000).toLocaleDateString(),
                        time: new Date(timestamp * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
                        detail: incomeType
                    });
                }
            });
        }

        return finalLogs;
    } catch (e) {
        console.error("DEBUG: History Error Trace:", e);
        return [];
    }
}

async function fetchAndDisplayData() {
    console.log("Fetching Leadership Data...");
    try {
        if (!window.contract || !window.signer) {
            console.error("Contract/Signer not ready");
            return;
        }

        const userAddress = await window.signer.getAddress();
        
        // 1. Force Dashboard Sync
        if (typeof window.fetchAllData === 'function') {
            await window.fetchAllData(userAddress);
        }

        // 2. Contract se data layein
        const stats = await window.contract.getUserStats(userAddress);
        const teamBusinessWei = await window.contract.totalTeamBusiness(userAddress);
        
        // 3. Data format karein
        const teamBusiness = parseFloat(ethers.utils.formatEther(teamBusinessWei));
        const teamCount = parseInt(stats[5].toString());
        const currentRank = stats[6]; // Contract ka rank string

        console.log("Stats Loaded:", { teamCount, teamBusiness, currentRank });

        // 4. UI Update (Leadership Specific)
        if(document.getElementById('team-total-deposit')) 
            document.getElementById('team-total-deposit').innerText = teamBusiness.toFixed(2);
        if(document.getElementById('current-team-count')) 
            document.getElementById('current-team-count').innerText = teamCount;
        if(document.getElementById('rank-reward-available')) 
            document.getElementById('rank-reward-available').innerText = parseFloat(ethers.utils.formatEther(stats[3])).toFixed(2);

        // 5. Progress Bar Update
        if(window.rankPlan) {
            const rankIndex = window.rankPlan.findIndex(r => r.name.toLowerCase() === currentRank.toLowerCase());
            const safeRankIndex = rankIndex === -1 ? 0 : rankIndex;
            
            if(typeof window.updateLeadershipUI === 'function') {
                window.updateLeadershipUI(teamCount, teamBusiness, safeRankIndex);
            }
        }
    } catch (error) {
        console.error("Data Load Error:", error);
    }
}


async function fetchAllData(address) {
    // Referrer URL Setup
    const refUrl = `${window.location.origin}/register.html?ref=${address}`; 
    const refInput = document.getElementById('refURL');
    if(refInput) refInput.value = refUrl;
    
    // Address display fix
    const addrDisplay = document.getElementById('user-address');
    if(addrDisplay) addrDisplay.innerText = address.substring(0, 6) + "..." + address.substring(38);
    
    try {
        // --- Contract Ready Check ---
        if (!window.contract) {
            console.warn("Contract not initialized yet, waiting...");
            setTimeout(() => fetchAllData(address), 1000); // 1 सेकंड बाद फिर ट्राई करेगा
            return;
        }

        // 1. User Details Fetch
        const user = await window.contract.getUserDetails(address); 
        
        // 2. Bonus Wallet Fetch
        const bonus = await window.contract.userBonusUSDTWallet(address);

        // --- Dashboard UI Mapping ---
        updateText('total-deposit', format(user[3]));         // totalSelfPurchasing
        updateText('total-earned', format(bonus[3]));        // totalCreditedBonus
        updateText('total-withdrawn', format(bonus[6]));     // totalWithdrawalBonus
        updateText('team-count', user[8] ? user[8].toString() : "0");        // noOfTotalTeam
        updateText('directs-count', user[7] ? user[7].toString() : "0");     // totalDirect
        
        // Income Details
        updateText('intro-earning', format(bonus[0]));       // referralBonus
        updateText('active-earning', format(bonus[1]));      // activeorbitBonus
        updateText('passive-earning', format(bonus[2]));     // passiveorbitBonus
        updateText('global-earning', format(bonus[11]));     // globalGiftBonus
        updateText('skipped-earning', format(bonus[5]));     // totalSkippedBonus
        updateText('direct-gift', format(bonus[8]));         // directWorkGiftBonus
        updateText('team-gift', format(bonus[9]));           // teamWorkGiftBonus
        updateText('passive-gift', format(bonus[7]));        // passiveGiftBonus

        // Withdrawable Balance
        updateText('available-balance', format(bonus[4]));   // totalAvailableBonus
        updateText('withdraw-balance-display', format(bonus[4]));

    } catch (err) { 
        console.error("Data Sync Error:", err); 
    }
}

// Helpers - Ethers v5 compatibility
const format = (val) => {
    try {
        // ethers.utils मौजूद है या नहीं चेक करें
        if (typeof ethers !== 'undefined' && ethers.utils) {
            return val ? parseFloat(ethers.utils.formatEther(val.toString())).toFixed(2) : "0.00";
        }
        return "0.00";
    } catch (e) {
        return "0.00";
    }
};

const updateText = (id, val) => {
    const elements = document.querySelectorAll(`[id="${id}"]`);
    if (elements.length > 0) {
        elements.forEach(el => el.innerText = val);
    }
};

// init() function load होने पर ट्रिगर करें
window.addEventListener('load', init);
