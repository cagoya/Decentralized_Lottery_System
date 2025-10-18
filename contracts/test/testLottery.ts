import { expect } from "chai";
import { ethers } from "hardhat";
import { Lottery, MyERC20, MyERC721 } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber } from "ethers";

describe("Lottery Contract", function () {
  let lottery: Lottery;
  let myERC20: MyERC20;
  let myERC721: MyERC721;
  let manager: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let managerAddress: string;
  let user1Address: string;
  let user2Address: string;
  let user3Address: string;

  beforeEach(async function () {
    // 获取测试账户
    [manager, user1, user2, user3] = await ethers.getSigners();
    managerAddress = manager.address;
    user1Address = user1.address;
    user2Address = user2.address;
    user3Address = user3.address;

    // 部署 Lottery 合约
    const LotteryFactory = await ethers.getContractFactory("Lottery");
    lottery = await LotteryFactory.deploy();
    await lottery.deployed();

    // 获取 ERC20 和 ERC721 合约地址
    const erc20Address = await lottery.myERC20();
    const erc721Address = await lottery.myERC721();

    // 连接到已部署的 ERC20 和 ERC721 合约
    myERC20 = await ethers.getContractAt("MyERC20", erc20Address);
    myERC721 = await ethers.getContractAt("MyERC721", erc721Address);

    // 给用户空投代币
    await myERC20.connect(user1).airdrop();
    await myERC20.connect(user2).airdrop();
    await myERC20.connect(user3).airdrop();
  });

  describe("Deployment", function () {
    it("Should set the right manager", async function () {
      expect(await lottery.manager()).to.equal(managerAddress);
    });

    it("Should deploy ERC20 and ERC721 contracts", async function () {
      expect(await lottery.myERC20()).to.not.equal(ethers.constants.AddressZero);
      expect(await lottery.myERC721()).to.not.equal(ethers.constants.AddressZero);
    });

    it("Should initialize counters to 0", async function () {
      expect(await lottery.activityIdCounter()).to.equal(0);
      expect(await lottery.listingIdCounter()).to.equal(0);
    });
  });

  describe("MyERC20 Airdrop", function () {
    it("Should allow users to claim airdrop", async function () {
      const user4 = (await ethers.getSigners())[4];
      await myERC20.connect(user4).airdrop();
      expect(await myERC20.balanceOf(await user4.getAddress())).to.equal(10000);
    });

    it("Should not allow double airdrop", async function () {
      const user4 = (await ethers.getSigners())[4];
      await myERC20.connect(user4).airdrop();
      await expect(
        myERC20.connect(user4).airdrop()
      ).to.be.revertedWith("This user has claimed airdrop already");
    });

    it("Should give users 10000 tokens from airdrop", async function () {
      expect(await myERC20.balanceOf(user1Address)).to.equal(10000);
    });
  });

  describe("Create Activity", function () {
    it("Should create activity successfully", async function () {
      const currentTime = await time.latest();
      const endTime = currentTime + 3600; // 1 hour later
      const baseAmount = 1000;

      await lottery.createActivity(
        "Football Match",
        ["Team A", "Team B"],
        endTime,
        baseAmount
      );

      const activities = await lottery.getActivities();
      expect(activities.length).to.equal(1);
      expect(activities[0].name).to.equal("Football Match");
      expect(activities[0].options).to.deep.equal(["Team A", "Team B"]);
      expect(activities[0].baseAmount).to.equal(baseAmount);
      expect(activities[0].totalAmount).to.equal(baseAmount);
      expect(activities[0].status).to.equal(0); // ActivityStatus.Active
    });

    it("Should mint base amount to contract", async function () {
      const currentTime = await time.latest();
      const endTime = currentTime + 3600;
      const baseAmount = 1000;

      const contractBalanceBefore = await myERC20.balanceOf(lottery.address);
      await lottery.createActivity("Test", ["A", "B"], endTime, baseAmount);
      const contractBalanceAfter = await myERC20.balanceOf(lottery.address);

      expect(contractBalanceAfter.sub(contractBalanceBefore)).to.equal(baseAmount);
    });

    it("Should fail if not manager", async function () {
      const currentTime = await time.latest();
      const endTime = currentTime + 3600;

      await expect(
        lottery.connect(user1).createActivity("Test", ["A", "B"], endTime, 1000)
      ).to.be.reverted;
    });

    it("Should fail with less than 2 options", async function () {
      const currentTime = await time.latest();
      const endTime = currentTime + 3600;

      await expect(
        lottery.createActivity("Test", ["A"], endTime, 1000)
      ).to.be.revertedWith("At least 2 options required");
    });

    it("Should fail with past end time", async function () {
      const currentTime = await time.latest();
      const endTime = currentTime - 1; // past time

      await expect(
        lottery.createActivity("Test", ["A", "B"], endTime, 1000)
      ).to.be.revertedWith("End time must be in the future");
    });

    it("Should increment activity counter", async function () {
      const currentTime = await time.latest();
      const endTime = currentTime + 3600;

      await lottery.createActivity("Test1", ["A", "B"], endTime, 1000);
      expect(await lottery.activityIdCounter()).to.equal(1);

      await lottery.createActivity("Test2", ["A", "B"], endTime, 1000);
      expect(await lottery.activityIdCounter()).to.equal(2);
    });
  });

  describe("Buy Ticket", function () {
    let activityId: number;
    let endTime: number;

    beforeEach(async function () {
      const currentTime = await time.latest();
      endTime = currentTime + 3600;
      await lottery.createActivity("Test Activity", ["Option A", "Option B"], endTime, 1000);
      activityId = 0;

      // 用户需要先授权
      await myERC20.connect(user1).approve(lottery.address, 10000);
      await myERC20.connect(user2).approve(lottery.address, 10000);
    });

    it("Should buy ticket successfully", async function () {
      const amount = 100;
      await lottery.connect(user1).buyTicket(activityId, 0, amount);

      const tickets = await lottery.getTicketsByOwner(user1Address);
      expect(tickets.length).to.equal(1);
      expect(tickets[0].activityId).to.equal(activityId);
      expect(tickets[0].amount).to.equal(amount);
      expect(tickets[0].optionIndex).to.equal(0);
    });

    it("Should mint NFT to user", async function () {
      await lottery.connect(user1).buyTicket(activityId, 0, 100);
      expect(await myERC721.ownerOf(0)).to.equal(user1Address);
    });

    it("Should transfer tokens from user to contract", async function () {
      const userBalanceBefore = await myERC20.balanceOf(user1Address);
      const contractBalanceBefore = await myERC20.balanceOf(lottery.address);
      const amount = 100;

      await lottery.connect(user1).buyTicket(activityId, 0, amount);

      const userBalanceAfter = await myERC20.balanceOf(user1Address);
      const contractBalanceAfter = await myERC20.balanceOf(lottery.address);

      expect(userBalanceBefore.sub(userBalanceAfter)).to.equal(amount);
      expect(contractBalanceAfter.sub(contractBalanceBefore)).to.equal(amount);
    });

    it("Should increase activity total amount", async function () {
      const amount = 100;
      await lottery.connect(user1).buyTicket(activityId, 0, amount);

      const activity = await lottery.getActivityById(activityId);
      expect(activity.totalAmount).to.equal(activity.baseAmount + amount);
    });

    it("Should fail with invalid activity ID", async function () {
      await expect(
        lottery.connect(user1).buyTicket(999, 0, 100)
      ).to.be.revertedWith("Activity does not exist");
    });

    it("Should fail with invalid option index", async function () {
      await expect(
        lottery.connect(user1).buyTicket(activityId, 999, 100)
      ).to.be.revertedWith("Invalid option index");
    });

    it("Should fail with zero amount", async function () {
      await expect(
        lottery.connect(user1).buyTicket(activityId, 0, 0)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should fail after activity drawn", async function () {
      // 先购买一些票，这样才能开奖
      await lottery.connect(user1).buyTicket(activityId, 0, 100);
      await time.increaseTo(endTime + 1);
      await lottery.drawLottery(activityId, 0);
      await expect(
        lottery.connect(user1).buyTicket(activityId, 0, 100)
      ).to.be.revertedWith("Activity is not active");
    });

    it("Should allow multiple users to buy tickets", async function () {
      await lottery.connect(user1).buyTicket(activityId, 0, 100);
      await lottery.connect(user2).buyTicket(activityId, 1, 200);

      const user1Tickets = await lottery.getTicketsByOwner(user1Address);
      const user2Tickets = await lottery.getTicketsByOwner(user2Address);

      expect(user1Tickets.length).to.equal(1);
      expect(user2Tickets.length).to.equal(1);
      expect(user1Tickets[0].optionIndex).to.equal(0);
      expect(user2Tickets[0].optionIndex).to.equal(1);
    });
  });

  describe("List Ticket", function () {
    let activityId: number;
    let ticketId: number;
    let endTime: number;

    beforeEach(async function () {
      const currentTime = await time.latest();
      endTime = currentTime + 3600;
      await lottery.createActivity("Test Activity", ["Option A", "Option B"], endTime, 1000);
      activityId = 0;

      await myERC20.connect(user1).approve(lottery.address, 10000);
      await lottery.connect(user1).buyTicket(activityId, 0, 100);
      ticketId = 0;

      // 授权 NFT 给合约
      await myERC721.connect(user1).approve(lottery.address, ticketId);
    });

    it("Should list ticket successfully", async function () {
      const price = 150;
      await lottery.connect(user1).listTicket(ticketId, price);

      const listings = await lottery.getListingsByActivityId(activityId);
      expect(listings.length).to.equal(1);
      expect(listings[0].ticketId).to.equal(ticketId);
      expect(listings[0].price).to.equal(price);
      expect(listings[0].seller).to.equal(user1Address);
    });

    it("Should transfer NFT to contract", async function () {
      await lottery.connect(user1).listTicket(ticketId, 150);
      expect(await myERC721.ownerOf(ticketId)).to.equal(lottery.address);
    });

    it("Should mark ticket as on sale", async function () {
      await lottery.connect(user1).listTicket(ticketId, 150);
      const tickets = await lottery.tickets(ticketId);
      expect(tickets.onSale).to.equal(true);
    });

    it("Should fail if not owner", async function () {
      await expect(
        lottery.connect(user2).listTicket(ticketId, 150)
      ).to.be.revertedWith("You are not the owner of this ticket");
    });

    it("Should fail with zero price", async function () {
      await expect(
        lottery.connect(user1).listTicket(ticketId, 0)
      ).to.be.revertedWith("Price must be greater than 0");
    });

    it("Should fail if not owner (after listing)", async function () {
      await lottery.connect(user1).listTicket(ticketId, 150);
      // 在出售后，NFT已经转移给合约，用户不再是拥有者
      await expect(
        lottery.connect(user1).listTicket(ticketId, 200)
      ).to.be.revertedWith("You are not the owner of this ticket");
    });
  });

  describe("Buy Listing", function () {
    let activityId: number;
    let ticketId: number;
    let listingId: number;
    let price: number;

    beforeEach(async function () {
      const currentTime = await time.latest();
      const endTime = currentTime + 3600;
      await lottery.createActivity("Test Activity", ["Option A", "Option B"], endTime, 1000);
      activityId = 0;

      await myERC20.connect(user1).approve(lottery.address, 10000);
      await lottery.connect(user1).buyTicket(activityId, 0, 100);
      ticketId = 0;

      await myERC721.connect(user1).approve(lottery.address, ticketId);
      price = 150;
      await lottery.connect(user1).listTicket(ticketId, price);
      listingId = 0;

      await myERC20.connect(user2).approve(lottery.address, 10000);
    });

    it("Should buy listing successfully", async function () {
      await lottery.connect(user2).buyListing(listingId);

      const listing = await lottery.listings(listingId);
      expect(listing.status).to.equal(2); // Sold
    });

    it("Should transfer NFT to buyer", async function () {
      await lottery.connect(user2).buyListing(listingId);
      expect(await myERC721.ownerOf(ticketId)).to.equal(user2Address);
    });

    it("Should transfer payment to seller", async function () {
      const sellerBalanceBefore = await myERC20.balanceOf(user1Address);
      const buyerBalanceBefore = await myERC20.balanceOf(user2Address);

      await lottery.connect(user2).buyListing(listingId);

      const sellerBalanceAfter = await myERC20.balanceOf(user1Address);
      const buyerBalanceAfter = await myERC20.balanceOf(user2Address);

      expect(sellerBalanceAfter.sub(sellerBalanceBefore)).to.equal(price);
      expect(buyerBalanceBefore.sub(buyerBalanceAfter)).to.equal(price);
    });

    it("Should update ticket ownership", async function () {
      await lottery.connect(user2).buyListing(listingId);
      const user2Tickets = await lottery.getTicketsByOwner(user2Address);
      expect(user2Tickets.length).to.equal(1);
    });

    it("Should mark ticket as not on sale", async function () {
      await lottery.connect(user2).buyListing(listingId);
      const ticket = await lottery.tickets(ticketId);
      expect(ticket.onSale).to.equal(false);
    });

    it("Should fail if buyer is seller", async function () {
      await expect(
        lottery.connect(user1).buyListing(listingId)
      ).to.be.revertedWith("You cannot buy your own listing");
    });

    it("Should fail if listing not active", async function () {
      await lottery.connect(user2).buyListing(listingId);
      await expect(
        lottery.connect(user3).buyListing(listingId)
      ).to.be.revertedWith("Listing is not active");
    });
  });

  describe("Cancel Listing", function () {
    let activityId: number;
    let ticketId: number;
    let listingId: number;

    beforeEach(async function () {
      const currentTime = await time.latest();
      const endTime = currentTime + 3600;
      await lottery.createActivity("Test Activity", ["Option A", "Option B"], endTime, 1000);
      activityId = 0;

      await myERC20.connect(user1).approve(lottery.address, 10000);
      await lottery.connect(user1).buyTicket(activityId, 0, 100);
      ticketId = 0;

      await myERC721.connect(user1).approve(lottery.address, ticketId);
      await lottery.connect(user1).listTicket(ticketId, 150);
      listingId = 0;
    });

    it("Should cancel listing successfully", async function () {
      await lottery.connect(user1).cancelListing(listingId);

      const listing = await lottery.listings(listingId);
      expect(listing.status).to.equal(1); // Cancelled
    });

    it("Should return NFT to owner", async function () {
      await lottery.connect(user1).cancelListing(listingId);
      expect(await myERC721.ownerOf(ticketId)).to.equal(user1Address);
    });

    it("Should mark ticket as not on sale", async function () {
      await lottery.connect(user1).cancelListing(listingId);
      const ticket = await lottery.tickets(ticketId);
      expect(ticket.onSale).to.equal(false);
    });

    it("Should fail if not seller", async function () {
      await expect(
        lottery.connect(user2).cancelListing(listingId)
      ).to.be.revertedWith("You are not the seller");
    });

    it("Should fail if already cancelled", async function () {
      await lottery.connect(user1).cancelListing(listingId);
      await expect(
        lottery.connect(user1).cancelListing(listingId)
      ).to.be.revertedWith("Listing is not active");
    });
  });

  describe("Draw Lottery", function () {
    let activityId: number;
    let endTime: number;

    beforeEach(async function () {
      const currentTime = await time.latest();
      endTime = currentTime + 3600;
      await lottery.createActivity("Test Activity", ["Option A", "Option B"], endTime, 1000);
      activityId = 0;

      // 多个用户购买凭证
      await myERC20.connect(user1).approve(lottery.address, 10000);
      await myERC20.connect(user2).approve(lottery.address, 10000);
      await myERC20.connect(user3).approve(lottery.address, 10000);

      await lottery.connect(user1).buyTicket(activityId, 0, 100);
      await lottery.connect(user2).buyTicket(activityId, 0, 200);
      await lottery.connect(user3).buyTicket(activityId, 1, 300);
    });

    it("Should draw lottery successfully", async function () {
      await time.increaseTo(endTime + 1);
      await lottery.drawLottery(activityId, 0);

      const activity = await lottery.getActivityById(activityId);
      expect(activity.status).to.equal(1); // ActivityStatus.Drawn
      expect(activity.winningOptionIndex).to.equal(0);
    });

    it("Should distribute prizes to winners", async function () {
      const user1BalanceBefore = await myERC20.balanceOf(user1Address);
      const user2BalanceBefore = await myERC20.balanceOf(user2Address);

      await time.increaseTo(endTime + 1);
      await lottery.drawLottery(activityId, 0);

      const user1BalanceAfter = await myERC20.balanceOf(user1Address);
      const user2BalanceAfter = await myERC20.balanceOf(user2Address);

      // user1 and user2 选择了 option 0, 他们应该获得奖金
      expect(user1BalanceAfter).to.be.gt(user1BalanceBefore);
      expect(user2BalanceAfter).to.be.gt(user2BalanceBefore);
    });

    it("Should distribute prizes proportionally", async function () {
      const user1BalanceBefore = await myERC20.balanceOf(user1Address);
      const user2BalanceBefore = await myERC20.balanceOf(user2Address);

      await time.increaseTo(endTime + 1);
      await lottery.drawLottery(activityId, 0);

      const user1BalanceAfter = await myERC20.balanceOf(user1Address);
      const user2BalanceAfter = await myERC20.balanceOf(user2Address);

      const user1Prize = user1BalanceAfter.sub(user1BalanceBefore);
      const user2Prize = user2BalanceAfter.sub(user2BalanceBefore);

      // user2 投注了 user1 的两倍，所以奖金也应该是两倍
      expect(user2Prize).to.equal(user1Prize.mul(2));
    });

    it("Should not give prizes to losers", async function () {
      const user3BalanceBefore = await myERC20.balanceOf(user3Address);

      await time.increaseTo(endTime + 1);
      await lottery.drawLottery(activityId, 0);

      const user3BalanceAfter = await myERC20.balanceOf(user3Address);

      // user3 选择了 option 1, 没有获胜
      expect(user3BalanceAfter).to.equal(user3BalanceBefore);
    });

    it("Should fail if not manager", async function () {
      await time.increaseTo(endTime + 1);
      await expect(
        lottery.connect(user1).drawLottery(activityId, 0)
      ).to.be.reverted;
    });

    it("Should fail if activity not ended", async function () {
      await expect(
        lottery.drawLottery(activityId, 0)
      ).to.be.revertedWith("Activity has not ended yet");
    });

    it("Should fail if already drawn", async function () {
      await time.increaseTo(endTime + 1);
      await lottery.drawLottery(activityId, 0);

      await expect(
        lottery.drawLottery(activityId, 0)
      ).to.be.revertedWith("Activity is not active");
    });

    it("Should fail with invalid option index", async function () {
      await time.increaseTo(endTime + 1);
      await expect(
        lottery.drawLottery(activityId, 999)
      ).to.be.revertedWith("Invalid option index");
    });

    it("Should fail if no winning tickets", async function () {
      // 创建一个新活动，但只有一个选项有人投注
      const currentTime = await time.latest();
      const newEndTime = currentTime + 7200;
      await lottery.createActivity("Test Activity 2", ["A", "B", "C"], newEndTime, 1000);
      
      await lottery.connect(user1).buyTicket(1, 0, 100);
      
      await time.increaseTo(newEndTime + 1);
      
      // 选择没有人投注的选项
      await expect(
        lottery.drawLottery(1, 2)
      ).to.be.revertedWith("No winning tickets");
    });
  });

  describe("Query Functions", function () {
    let activityId: number;

    beforeEach(async function () {
      const currentTime = await time.latest();
      const endTime = currentTime + 3600;
      await lottery.createActivity("Activity 1", ["A", "B"], endTime, 1000);
      await lottery.createActivity("Activity 2", ["X", "Y"], endTime, 2000);
      activityId = 0;

      await myERC20.connect(user1).approve(lottery.address, 10000);
      await lottery.connect(user1).buyTicket(0, 0, 100);
      await lottery.connect(user1).buyTicket(1, 1, 200);
    });

    it("Should get all activities", async function () {
      const activities = await lottery.getActivities();
      expect(activities.length).to.equal(2);
      expect(activities[0].name).to.equal("Activity 1");
      expect(activities[1].name).to.equal("Activity 2");
    });

    it("Should get activity by ID", async function () {
      const activity = await lottery.getActivityById(0);
      expect(activity.name).to.equal("Activity 1");
      expect(activity.baseAmount).to.equal(1000);
    });

    it("Should get tickets by owner", async function () {
      const tickets = await lottery.getTicketsByOwner(user1Address);
      expect(tickets.length).to.equal(2);
      expect(tickets[0].activityId).to.equal(0);
      expect(tickets[1].activityId).to.equal(1);
    });

    it("Should get listings by activity ID", async function () {
      await myERC721.connect(user1).approve(lottery.address, 0);
      await lottery.connect(user1).listTicket(0, 150);

      const listings = await lottery.getListingsByActivityId(0);
      expect(listings.length).to.equal(1);
      expect(listings[0].activityId).to.equal(0);
    });

    it("Should get listings by seller", async function () {
      await myERC721.connect(user1).approve(lottery.address, 0);
      await myERC721.connect(user1).approve(lottery.address, 1);
      await lottery.connect(user1).listTicket(0, 150);
      await lottery.connect(user1).listTicket(1, 250);

      const listings = await lottery.getListingsBySeller(user1Address);
      expect(listings.length).to.equal(2);
    });

    it("Should return all listings including cancelled ones", async function () {
      await myERC721.connect(user1).approve(lottery.address, 0);
      await lottery.connect(user1).listTicket(0, 150);
      await lottery.connect(user1).cancelListing(0);

      const listings = await lottery.getListingsByActivityId(0);
      expect(listings.length).to.equal(1);
      expect(listings[0].status).to.equal(1); // ListingStatus.Cancelled
    });
  });

  describe("Complex Scenarios", function () {
    it("Should handle complete lottery lifecycle", async function () {
      // 1. 创建活动
      const currentTime = await time.latest();
      const endTime = currentTime + 3600;
      await lottery.createActivity("World Cup", ["Brazil", "Germany", "France"], endTime, 5000);

      // 2. 多个用户购买凭证
      await myERC20.connect(user1).approve(lottery.address, 10000);
      await myERC20.connect(user2).approve(lottery.address, 10000);
      await myERC20.connect(user3).approve(lottery.address, 10000);

      await lottery.connect(user1).buyTicket(0, 0, 1000); // Brazil
      await lottery.connect(user2).buyTicket(0, 1, 2000); // Germany
      await lottery.connect(user3).buyTicket(0, 0, 1000); // Brazil

      // 3. user1 出售他的凭证
      await myERC721.connect(user1).approve(lottery.address, 0);
      await lottery.connect(user1).listTicket(0, 1200);

      // 4. user2 购买 user1 的凭证
      await lottery.connect(user2).buyListing(0);

      // 5. 时间到，开奖
      await time.increaseTo(endTime + 1);
      await lottery.drawLottery(0, 0); // Brazil wins

      // 6. 验证获胜者获得了奖金
      const activity = await lottery.getActivityById(0);
      expect(activity.status).to.equal(1); // ActivityStatus.Drawn
      expect(activity.winningOptionIndex).to.equal(0);
    });

    it("Should handle multiple activities simultaneously", async function () {
      const currentTime = await time.latest();
      const endTime1 = currentTime + 3600;
      const endTime2 = currentTime + 7200;

      // 创建两个活动
      await lottery.createActivity("Activity 1", ["A", "B"], endTime1, 1000);
      await lottery.createActivity("Activity 2", ["X", "Y"], endTime2, 2000);

      // 用户在两个活动中都购买
      await myERC20.connect(user1).approve(lottery.address, 10000);
      await lottery.connect(user1).buyTicket(0, 0, 100);
      await lottery.connect(user1).buyTicket(1, 0, 200);

      const tickets = await lottery.getTicketsByOwner(user1Address);
      expect(tickets.length).to.equal(2);

      // 第一个活动开奖
      await time.increaseTo(endTime1 + 1);
      await lottery.drawLottery(0, 0);

      const activity1 = await lottery.getActivityById(0);
      expect(activity1.status).to.equal(1); // ActivityStatus.Drawn

      // 第二个活动还未开奖
      const activity2 = await lottery.getActivityById(1);
      expect(activity2.status).to.equal(0); // ActivityStatus.Active
    });
  });
});

