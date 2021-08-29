const SearchBiz = require('../../biz/search_biz.js');
const ccminiPageHelper = require('../../helper/ccmini_page_helper.js');
const PassportBiz = require('../../biz/passport_biz.js');


Page({

	/**
	 * 页面的初始数据
	 */
	data: {
		type: '', // 来自哪个业务标识
		returnUrl: '', //搜索完返回哪个地址
		cacheName: '', //本业务搜索历史缓存
		search: '', //搜索关键字

		hisKeys: []
	},

	/**
	 * 生命周期函数--监听页面加载
	 */
	onLoad: async function (options) {
		await PassportBiz.initPage(this);
	},

	/**
	 * 生命周期函数--监听页面初次渲染完成
	 */
	onReady: function () {

	},

	/**
	 * 生命周期函数--监听页面显示
	 */
	onShow: function () {
		// 获取当前小程序的页面栈
		let pages = getCurrentPages();
		// 数组中索引最大的页面--当前页面
		let currentPage = pages[pages.length - 1];
		// 附加参数 

		if (currentPage.options && currentPage.options.type) {

			let type = currentPage.options.type;

			let cacheName = 'SERACH_HIS_' + type;
			this.setData({
				type,
				cacheName
			});

			let hisKeys = SearchBiz.getHistory(this.data.cacheName);
			this.setData({
				hisKeys
			});
		}

	},

	/**
	 * 生命周期函数--监听页面隐藏
	 */
	onHide: function () {

	},

	/**
	 * 生命周期函数--监听页面卸载
	 */
	onUnload: function () {

	},

	url: function (e) {
		ccminiPageHelper.url(e);
	},


	/**
	 *  点击确认搜索
	 */
	bindSearchConfirm: function (e) {

		if (!this.data.type) return;

		let search = this.data.search.trim();
		if (!search) return;

		// 历史记录
		let hisKeys = SearchBiz.addHistory(this.data.cacheName, search);
		this.setData({
			search,
			hisKeys
		});

		let prevPage = ccminiPageHelper.getPrevPage();
		// 直接调用上一个页面的setData()方法，把数据存到上一个页面中去
		prevPage.setData({
			search,
		})

		ccminiPageHelper.goto('', 'back');

	},

	// 清空搜索记录
	bindDelHisTap: function (e) {
		SearchBiz.clearHistory(this.data.cacheName);
		this.setData({
			hisKeys: []
		});
	},

	//清除关键字
	bindClearKeyTap: function (e) {
		this.setData({
			search: ''
		});
	},

	// 点击历史
	bindKeyTap: function (e) {
		let search = e.currentTarget.dataset.key.trim();
		if (search) {
			this.setData({
				search
			});
			this.bindSearchConfirm(e);
		}
	},

})