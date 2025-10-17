// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./MyERC20.sol";
import "./MyERC721.sol";

contract Lottery {
    // 管理员，用来发布彩票、开奖和退款
    address public manager;
    // 彩票相关的代币合约和NFT合约
    MyERC20 public myERC20;
    MyERC721 public myERC721;

    // 活动ID计数器
    uint256 public activityIdCounter;
    // 出售ID计数器
    uint256 public listingIdCounter;

    // 出售状态枚举
    enum ListingStatus {Selling, Cancelled, Sold}

    // 活动结构体
    struct Activity {
        uint256 id; // 活动ID
        string name; // 活动名称
        string[] options; // 选项列表
        uint256 endTime; // 结束时间
        uint256 baseAmount; // 奖池基础金额
        uint256 totalAmount; // 奖池目前总金额
        bool drawn; // 是否已开奖
        uint256 winningOptionIndex; // 获胜选项索引
    }

    // 凭证结构体
    struct Ticket {
        uint256 id; // 凭证NFT的ID
        uint256 activityId; // 活动ID
        uint256 amount; // 投注金额
        uint256 optionIndex; // 投注选项索引
        uint256 endTime; // 结束时间
        bool onSale; // 是否在出售
    }

    // 出售结构体
    struct Listing {
        uint256 id; // 出售ID
        uint256 ticketId; // 凭证ID
        address seller; // 卖家地址
        uint256 price; // 价格
        uint256 activityId; // 活动ID
        uint256 amount; // 金额
        uint256 optionIndex; // 选项ID
        uint256 endTime; // 截止时间
        ListingStatus status; // 状态
    }

    // 活动列表
    Activity[] public activities;
    // 凭证列表
    Ticket[] public tickets;
    // 出售ID到出售信息的映射
    Listing[] public listings;
    // 拥有者地址到凭证Id列表的映射
    mapping(address => uint256[]) public ownerToTicketIds;
    // 活动ID到TicketId列表的映射
    mapping(uint256 => uint256[]) public activityIdToTicketIds;
    // 活动ID到ListingId列表的映射
    mapping(uint256 => uint256[]) public activityIdToListingIds;
    // 凭证ID到ListingId的映射
    mapping(uint256 => uint256) public ticketIdToListingId;

    // 验证是否为管理员
    modifier onlyManager {
        require(msg.sender == manager);
        _;
    }

    constructor() {
        myERC20 = new MyERC20("ZJUToken", "ZJUTokenSymbol");
        myERC721 = new MyERC721("ZJUNFT", "ZJUNFTSymbol");
        activityIdCounter = 0;
        listingIdCounter = 0;
        manager = msg.sender;
    }

    // 发布竞猜活动
    function createActivity(string memory name, string[] memory options, uint256 endTime, uint256 baseAmount) public onlyManager {
        require(options.length >= 2, "At least 2 options required");
        require(endTime > block.timestamp, "End time must be in the future");
        
        activities.push(Activity({
            id: activityIdCounter,
            name: name,
            options: options,
            endTime: endTime,
            baseAmount: baseAmount,
            totalAmount: baseAmount,
            drawn: false,
            winningOptionIndex: 0
        }));
        activityIdCounter++;
        // 铸币，将基础金额转入奖池
        bool ok = myERC20.mint(address(this), baseAmount);
        require(ok, "Mint failed");
    }

    // 获取竞猜活动列表
    function getActivities() public view returns (Activity[] memory) {
        return activities;
    }

    // 根据ID获取活动信息
    function getActivityById(uint256 activityId) public view returns (Activity memory) {
        return activities[activityId];
    }
    
    // 购买凭证
    function buyTicket(uint256 activityId, uint256 optionIndex, uint256 amount) public {
        require(activityId < activities.length, "Activity does not exist");
        require(optionIndex < activities[activityId].options.length, "Invalid option index");
        require(block.timestamp < activities[activityId].endTime, "Activity has ended");
        require(!activities[activityId].drawn, "Activity already drawn");
        require(amount > 0, "Amount must be greater than 0");
        
        // 从用户账户中转移投注金额到合约账户
        bool ok = myERC20.transferFrom(msg.sender, address(this), amount);
        require(ok, "TransferFrom failed");
        
        // 创建凭证
        uint256 ticketId = myERC721.createTicket(msg.sender);
        Ticket memory ticket = Ticket({
            id: ticketId,
            activityId: activityId,
            amount: amount,
            optionIndex: optionIndex,
            endTime: activities[activityId].endTime,
            onSale: false
        });
        tickets.push(ticket);
        ownerToTicketIds[msg.sender].push(ticketId);
        activityIdToTicketIds[activityId].push(ticketId);
        
        // 将amount加入奖池
        activities[activityId].totalAmount += amount;
    }

    // 通过拥有者获取凭证列表
    function getTicketsByOwner(address owner) public view returns (Ticket[] memory) {
        uint256[] memory ticketIds = ownerToTicketIds[owner];
        Ticket[] memory result = new Ticket[](ticketIds.length);
        for (uint256 i = 0; i < ticketIds.length; i++) {
            result[i] = tickets[ticketIds[i]];
        }
        return result;
    }

    // 出售凭证
    function listTicket(uint256 ticketId, uint256 price) public {
        require(ticketId < tickets.length, "Ticket does not exist");
        // 验证发送者是否是NFT的拥有者
        require(myERC721.ownerOf(ticketId) == msg.sender, "You are not the owner of this ticket");
        // 验证凭证未在出售中
        require(!tickets[ticketId].onSale, "Ticket is already on sale");
        require(price > 0, "Price must be greater than 0");
        
        Ticket memory ticket = tickets[ticketId];
        require(!activities[ticket.activityId].drawn, "Activity already drawn");
        
        // 将凭证转移给合约
        myERC721.transferFrom(msg.sender, address(this), ticketId);
        
        // 创建挂单
        Listing memory listing = Listing({
            id: listingIdCounter,
            ticketId: ticketId,
            seller: msg.sender,
            price: price,
            activityId: ticket.activityId,
            amount: ticket.amount,
            optionIndex: ticket.optionIndex,
            endTime: ticket.endTime,
            status: ListingStatus.Selling
        });
        
        // 将ticket设为出售中
        tickets[ticketId].onSale = true;
        listings.push(listing);
        ticketIdToListingId[ticketId] = listingIdCounter;
        activityIdToListingIds[ticket.activityId].push(listingIdCounter);
        listingIdCounter++;
    }

    // 取消挂单
    function cancelListing(uint256 listingId) public {
        Listing storage listing = listings[listingId];
        require(listing.seller == msg.sender, "You are not the seller");
        require(listing.status == ListingStatus.Selling, "Listing is not active");
        
        uint256 ticketId = listing.ticketId;
        
        // 将NFT转移回拥有者
        myERC721.transferFrom(address(this), msg.sender, ticketId);
        
        // 更新状态
        tickets[ticketId].onSale = false;
        listing.status = ListingStatus.Cancelled;
    }

    // 购买挂单出售的凭证
    function buyListing(uint256 listingId) public {
        Listing storage listing = listings[listingId];
        require(listing.seller != address(0), "Listing does not exist");
        require(listing.seller != msg.sender, "You cannot buy your own listing");
        require(listing.status == ListingStatus.Selling, "Listing is not active");
        require(!activities[listing.activityId].drawn, "Activity already drawn");
        
        uint256 ticketId = listing.ticketId;
        
        // 从购买者账户转账给卖家
        bool ok = myERC20.transferFrom(msg.sender, listing.seller, listing.price);
        require(ok, "TransferFrom failed");
        
        // 将NFT转移给购买者
        myERC721.transferFrom(address(this), msg.sender, ticketId);
        
        // 更新凭证拥有者列表
        ownerToTicketIds[msg.sender].push(ticketId);
        
        // 从原拥有者列表中移除
        uint256[] storage sellerTickets = ownerToTicketIds[listing.seller];
        for (uint256 i = 0; i < sellerTickets.length; i++) {
            if (sellerTickets[i] == ticketId) {
                sellerTickets[i] = sellerTickets[sellerTickets.length - 1];
                sellerTickets.pop();
                break;
            }
        }
        
        // 更新状态
        tickets[ticketId].onSale = false;
        listing.status = ListingStatus.Sold;
    }
    
    // 通过活动ID获取挂单出售列表（只返回正在出售的）
    function getListingsByActivityId(uint256 activityId) public view returns (Listing[] memory) {
        uint256[] memory listingIds = activityIdToListingIds[activityId];
        
        // 先计算有多少个正在出售的
        uint256 count = 0;
        for (uint256 i = 0; i < listingIds.length; i++) {
            if (listings[listingIds[i]].status == ListingStatus.Selling) {
                count++;
            }
        }
        
        // 构建结果数组
        Listing[] memory result = new Listing[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < listingIds.length; i++) {
            if (listings[listingIds[i]].status == ListingStatus.Selling) {
                result[index] = listings[listingIds[i]];
                index++;
            }
        }
        return result;
    }

    // 通过拥有者获取挂单出售列表（只返回正在出售的）
    function getListingsBySeller(address seller) public view returns (Listing[] memory) {
        uint256[] memory ticketIds = ownerToTicketIds[seller];
        uint256 count = 0;
        
        // 先计算有多少个在售的凭证
        for (uint256 i = 0; i < ticketIds.length; i++) {
            if (tickets[ticketIds[i]].onSale) {
                uint256 listingId = ticketIdToListingId[ticketIds[i]];
                if (listings[listingId].status == ListingStatus.Selling) {
                    count++;
                }
            }
        }
        
        // 构建结果数组
        Listing[] memory result = new Listing[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < ticketIds.length; i++) {
            if (tickets[ticketIds[i]].onSale) {
                uint256 listingId = ticketIdToListingId[ticketIds[i]];
                if (listings[listingId].status == ListingStatus.Selling) {
                    result[index] = listings[listingId];
                    index++;
                }
            }
        }
        return result;
    }
    
    // 开奖
    function drawLottery(uint256 activityId, uint256 winningOptionIndex) public onlyManager {
        require(activityId < activities.length, "Activity does not exist");
        Activity storage activity = activities[activityId];
        require(!activity.drawn, "Activity already drawn");
        require(winningOptionIndex < activity.options.length, "Invalid option index");
        require(block.timestamp >= activity.endTime, "Activity has not ended yet");
        
        // 标记活动已开奖
        activity.drawn = true;
        activity.winningOptionIndex = winningOptionIndex;
        
        // 获取该活动的所有凭证
        uint256[] memory activityTicketIds = activityIdToTicketIds[activityId];
        
        // 计算获胜者的总投注金额
        uint256 winningAmount = 0;
        for (uint256 i = 0; i < activityTicketIds.length; i++) {
            Ticket memory ticket = tickets[activityTicketIds[i]];
            if (ticket.optionIndex == winningOptionIndex) {
                winningAmount += ticket.amount;
            }
        }
        
        require(winningAmount > 0, "No winning tickets");
        
        // 分配奖金给获胜者（按照投注额比例）
        uint256 totalPrize = activity.totalAmount;
        for (uint256 i = 0; i < activityTicketIds.length; i++) {
            Ticket memory ticket = tickets[activityTicketIds[i]];
            if (ticket.optionIndex == winningOptionIndex) {
                address winner = myERC721.ownerOf(ticket.id);
                uint256 prize = (totalPrize * ticket.amount) / winningAmount;
                bool ok = myERC20.transfer(winner, prize);
                require(ok, "Prize transfer failed");
            }
        }
    }
}
