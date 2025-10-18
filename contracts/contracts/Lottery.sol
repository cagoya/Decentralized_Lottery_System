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
    // 活动状态枚举
    enum ActivityStatus {Active, Drawn, Refunded}

    // 活动结构体
    struct Activity {
        uint256 id; // 活动ID
        string name; // 活动名称
        string[] options; // 选项列表
        uint32 endTime; // 结束时间
        uint32 baseAmount; // 奖池基础金额
        uint32 totalAmount; // 奖池目前总金额
        ActivityStatus status; // 活动状态
        uint32 winningOptionIndex; // 获胜选项索引
    }

    // 凭证结构体
    struct Ticket {
        uint256 id; // 凭证NFT的ID
        uint256 activityId; // 活动ID
        uint32 amount; // 投注金额
        uint32 optionIndex; // 投注选项索引
        uint32 endTime; // 结束时间
        bool onSale; // 是否在出售
    }

    // 出售结构体
    struct Listing {
        uint256 id; // 出售ID
        uint256 ticketId; // 凭证ID
        address seller; // 卖家地址
        uint32 price; // 价格
        uint256 activityId; // 活动ID
        uint32 amount; // 金额
        uint32 optionIndex; // 选项ID
        uint32 endTime; // 截止时间
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
    function createActivity(string memory name, string[] memory options, uint32 endTime, uint32 baseAmount) public onlyManager {
        require(options.length >= 2, "At least 2 options required");
        require(endTime > block.timestamp, "End time must be in the future");
        
        activities.push(Activity({
            id: activityIdCounter,
            name: name,
            options: options,
            endTime: endTime,
            baseAmount: baseAmount,
            totalAmount: baseAmount,
            status: ActivityStatus.Active,
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
    function buyTicket(uint256 activityId, uint32 optionIndex, uint32 amount) public {
        require(activityId < activities.length, "Activity does not exist");
        require(optionIndex < activities[activityId].options.length, "Invalid option index");
        require(activities[activityId].status == ActivityStatus.Active, "Activity is not active");
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
    function listTicket(uint256 ticketId, uint32 price) public {
        // 验证凭证是否存在
        require(ticketId < tickets.length, "Ticket does not exist");
        // 验证发送者是否是NFT的拥有者
        require(myERC721.ownerOf(ticketId) == msg.sender, "You are not the owner of this ticket");
        // 验证凭证未在出售中
        require(!tickets[ticketId].onSale, "Ticket is already on sale");
        // 验证价格是否大于0
        require(price > 0, "Price must be greater than 0");
        // 验证活动进行中
        require(activities[tickets[ticketId].activityId].status == ActivityStatus.Active, "Activity is not active");

        Ticket memory ticket = tickets[ticketId];
        
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

    // 内部取消挂单函数
    function _cancelListing(uint256 listingId) internal {
        Listing storage listing = listings[listingId];
        if (listing.status != ListingStatus.Selling) {
            return; // 如果已经不是在售状态，跳过
        }
        
        uint256 ticketId = listing.ticketId;
        
        // 将NFT转移回卖家
        myERC721.transferFrom(address(this), listing.seller, ticketId);
        
        // 更新状态
        tickets[ticketId].onSale = false;
        listing.status = ListingStatus.Cancelled;
    }

    // 取消挂单
    function cancelListing(uint256 listingId) public {
        Listing storage listing = listings[listingId];
        require(listing.seller == msg.sender, "You are not the seller");
        require(listing.status == ListingStatus.Selling, "Listing is not active");
        
        _cancelListing(listingId);
    }

    // 购买挂单出售的凭证
    function buyListing(uint256 listingId) public {
        Listing storage listing = listings[listingId];
        // 验证挂单是否存在
        require(listing.seller != address(0), "Listing does not exist");
        // 验证卖家不是购买者
        require(listing.seller != msg.sender, "You cannot buy your own listing");
        // 验证挂单状态
        require(listing.status == ListingStatus.Selling, "Listing is not active");
        
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
    
    // 通过活动ID获取挂单出售列表
    function getListingsByActivityId(uint256 activityId) public view returns (Listing[] memory) {
        uint256[] memory listingIds = activityIdToListingIds[activityId];
        
        // 构建结果数组
        Listing[] memory result = new Listing[](listingIds.length);
        for (uint256 i = 0; i < listingIds.length; i++) {
            result[i] = listings[listingIds[i]];
        }
        return result;
    }

    // 通过拥有者获取挂单出售列表
    function getListingsBySeller(address seller) public view returns (Listing[] memory) {
        uint256[] memory ticketIds = ownerToTicketIds[seller];
        
        Listing[] memory result = new Listing[](ticketIds.length);
        for (uint256 i = 0; i < ticketIds.length; i++) {
            result[i] = listings[ticketIdToListingId[ticketIds[i]]];
        }
        return result;
    }
    
    // 开奖
    function drawLottery(uint256 activityId, uint32 winningOptionIndex) public onlyManager {
        require(activityId < activities.length, "Activity does not exist");
        Activity storage activity = activities[activityId];
        require(activity.status == ActivityStatus.Active, "Activity is not active");
        require(winningOptionIndex < activity.options.length, "Invalid option index");
        require(block.timestamp >= activity.endTime, "Activity has not ended yet");
        
        // 获取该活动的所有凭证
        uint256[] memory activityTicketIds = activityIdToTicketIds[activityId];
        
        // 计算获胜者的总投注金额
        uint32 winningAmount = 0;
        for (uint256 i = 0; i < activityTicketIds.length; i++) {
            Ticket memory ticket = tickets[activityTicketIds[i]];
            if (ticket.optionIndex == winningOptionIndex) {
                winningAmount += ticket.amount;
            }
        }
        
        require(winningAmount > 0, "No winning tickets");

        // 取消全部挂单（需要在标记为已开奖之前执行）
        cancelListingsByActivityId(activityId);

        // 标记活动已开奖
        activity.status = ActivityStatus.Drawn;
        activity.winningOptionIndex = winningOptionIndex;
        
        // 分配奖金给获胜者（按照投注额比例）
        uint32 totalPrize = activity.totalAmount;
        for (uint256 i = 0; i < activityTicketIds.length; i++) {
            Ticket storage ticket = tickets[activityTicketIds[i]];
            if (ticket.optionIndex == winningOptionIndex) {
                address winner = myERC721.ownerOf(ticket.id);
                // 向下取整
                uint32 prize = (totalPrize * ticket.amount) / winningAmount;
                bool ok = myERC20.transfer(winner, prize);
                require(ok, "Prize transfer failed");
            }
            ticket.onSale = false;
        }
    }

    // 退款
    function refund(uint256 activityId) public {
        require(activityId < activities.length, "Activity does not exist");
        Activity storage activity = activities[activityId];
        require(activity.status == ActivityStatus.Active, "Activity is not active");

        // 取消全部挂单
        cancelListingsByActivityId(activityId);
        
        // 标记活动已退款
        activity.status = ActivityStatus.Refunded;
        uint256[] memory activityTicketIds = activityIdToTicketIds[activityId];
        for (uint256 i = 0; i < activityTicketIds.length; i++) {
            Ticket storage ticket = tickets[activityTicketIds[i]];
            bool ok = myERC20.transfer(myERC721.ownerOf(ticket.id), ticket.amount);
            require(ok, "Refund transfer failed");
            ticket.onSale = false;
        }
    }

    // 取消一个活动的所有挂单
    function cancelListingsByActivityId(uint256 activityId) public onlyManager {
        require(activityId < activities.length, "Activity does not exist");
        Activity memory activity = activities[activityId];
        require(activity.status == ActivityStatus.Active, "Activity is not active");
        
        uint256[] memory activityListingIds = activityIdToListingIds[activityId];
        for (uint256 i = 0; i < activityListingIds.length; i++) {
            _cancelListing(activityListingIds[i]);
        }
    }
}
