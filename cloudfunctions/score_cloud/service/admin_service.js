// +----------------------------------------------------------------------
// | CCMiniCloud [ Cloud Framework ]
// +----------------------------------------------------------------------
// | Copyright (c) 2021 www.code942.com All rights reserved.
// +----------------------------------------------------------------------
// | Licensed ( http://www.apache.org/licenses/LICENSE-2.0 )
// +----------------------------------------------------------------------
// | Author: 明章科技
// +----------------------------------------------------------------------

/**
 * Notes: 后台管理模块
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY www.code942.com
 * Date: 2020-10-22 07:48:00 
 */

const BaseCCMiniService = require('./base_ccmini_service.js');

const ccminiDbUtil = require('../framework/database/ccmini_db_util.js');
const ccminiStrUtil = require('../framework/utils/ccmini_str_util.js');

const ccminiCloudUtil = require('../framework/cloud/ccmini_cloud_util.js');
const ccminiCloudBase = require('../framework/cloud/ccmini_cloud_base.js');
const ccminiUtil = require('../framework/utils/ccmini_util.js');
const ccminiTimeUtil = require('../framework/utils/ccmini_time_util.js');
const ccminiAppCode = require('../framework/handler/ccmini_app_code.js');

const ccminiConfig = require('../comm/ccmini_config.js');

const SetupModel = require('../model/setup_model.js');
const UserModel = require('../model/user_model.js');
const AdminModel = require('../model/admin_model.js');
const NewsModel = require('../model/news_model.js');
const GradeModel = require('../model/grade_model.js');

class AdminService extends BaseCCMiniService {

	async isAdmin(token) {
		let where = {
			ADMIN_TOKEN: token,
			ADMIN_TOKEN_TIME: ['>', ccminiTimeUtil.time() - ccminiConfig.CCMINI_ADMIN_LOGIN_EXPIRE * 1000],
			ADMIN_STATUS: 1,
		}
		let admin = await AdminModel.getOne(where);
		if (!admin)
			this.ccminiAppError('管理员不存在', ccminiAppCode.ADMIN_ERROR);

		return admin;
	}

	async adminHome() {
		let where = {};


		let userCnt = await UserModel.count(where);
		let newsCnt = await NewsModel.count(where);

		return {

			userCnt,
			newsCnt,
			projectVerCloud: ccminiConfig.PROJECT_VER,
			projectSource: ccminiConfig.PROJECT_SOURCE
		}
	}

	async adminLogin(name, password) {

		if (name != ccminiConfig.CCMINI_ADMIN_NAME)
			this.ccminiAppError('管理员账号或密码不正确');

		if (password != ccminiConfig.CCMINI_ADMIN_PWD)
			this.ccminiAppError('管理员账号或密码不正确');

		// 判断是否存在
		let where = {
			ADMIN_STATUS: 1
		}
		let fields = 'ADMIN_PHONE,ADMIN_ID,ADMIN_NAME,ADMIN_TYPE,ADMIN_LOGIN_TIME,ADMIN_LOGIN_CNT';
		let admin = await AdminModel.getOne(where, fields);
		if (!admin)
			this.ccminiAppError('管理员不存在');

		let cnt = admin.ADMIN_LOGIN_CNT;

		// 生成token
		let token = ccminiStrUtil.genRandomString(32);
		let tokenTime = ccminiTimeUtil.time();
		let data = {
			ADMIN_TOKEN: token,
			ADMIN_PHONE: ccminiConfig.CCMINI_ADMIN_NAME,
			ADMIN_TOKEN_TIME: tokenTime,
			ADMIN_LOGIN_TIME: ccminiTimeUtil.time(),
			ADMIN_LOGIN_CNT: cnt + 1
		}
		await AdminModel.edit(where, data);

		let type = admin.ADMIN_TYPE;
		let last = (!admin.ADMIN_LOGIN_TIME) ? '尚未登录' : ccminiTimeUtil.timestamp2Time(admin.ADMIN_LOGIN_TIME);


		return {
			token,
			name: admin.ADMIN_NAME,
			type,
			last,
			cnt
		}


	}



	async setupEdit({
		title,
		regCheck,
		about
	}) {

		let data = {
			SETUP_TITLE: title,
			SETUP_REG_CHECK: regCheck,
			SETUP_ABOUT: about
		}
		await SetupModel.edit({}, data);
	}


	/************** 系统设置 END ********************* */






	/************** 用户 BEGIN ********************* */
	async getUser({
		userId,
		fields = '*'
	}) {
		let where = {
			USER_MINI_OPENID: userId,
		}
		return await UserModel.getOne(where, fields);
	}

	async getUserList(userId, {
		search,
		sortType,
		sortVal,
		orderBy,
		whereEx,
		page,
		size,
		oldTotal = 0
	}) {

		orderBy = orderBy || {
			USER_ADD_TIME: 'desc'
		};
		let fields = 'USER_ADD_TIME,USER_VIEW_CNT,USER_EDU,USER_INFO_CNT,USER_ALBUM_CNT,USER_NAME,USER_BIRTH,USER_SEX,USER_PIC,USER_STATUS,USER_CITY,USER_COMPANY,USER_TRADE,USER_COMPANY_DUTY,USER_LOGIN_TIME,USER_MINI_OPENID';


		let where = {};
		where.and = {
			//USER_STATUS: UserModel.STATUS.COMM, 
		};

		if (ccminiUtil.isDefined(search) && search) {
			where.or = [{
					USER_NAME: ['like', search]
				},
				{
					USER_CITY: ['like', search]
				},
				{
					USER_TRADE: ['like', search]
				},
			];

		} else if (sortType && ccminiUtil.isDefined(sortVal)) {
			switch (sortType) {

				case 'sort':
					if (sortVal == 'new') { //最新
						orderBy = {
							'USER_ADD_TIME': 'desc'
						};
					}
					if (sortVal == 'last') { //最近
						orderBy = {
							'USER_LOGIN_TIME': 'desc',
							'USER_ADD_TIME': 'desc'
						};
					}

					if (sortVal == 'info') {
						orderBy = {
							'USER_INFO_CNT': 'desc',
							'USER_LOGIN_TIME': 'desc'
						};
					}
					if (sortVal == 'album') {
						orderBy = {
							'USER_ALBUM_CNT': 'desc',
							'USER_LOGIN_TIME': 'desc'
						};
					}

					break;
			}
		}
		let result = await UserModel.getList(where, fields, orderBy, page, size, true, oldTotal);


		return result;
	}

	async statusUser(id, status) {
		status = Number(status)
		let data = {
			USER_STATUS: status
		}
		let where = {
			'USER_MINI_OPENID': id
		}
		await UserModel.edit(where, data);



	}

	async delUser(id) {
		let whereUser = {
			USER_MINI_OPENID: id
		}


		UserModel.del(whereUser);



	}
	/************** 用户 END ********************* */



	/************** 资讯主体 BEGIN ********************* */

	async insertNews(adminId, {
		title,
		cate,
		content
	}) {

		// 重复性判断
		let where = {
			NEWS_TITLE: title,
		}
		if (await NewsModel.count(where))
			this.ccminiAppError('该标题已经存在');

		// 赋值 
		let data = {};
		data.NEWS_TITLE = title;
		data.NEWS_CONTENT = content;
		data.NEWS_CATE = cate;
		data.NEWS_DESC = ccminiStrUtil.fmtText(content, 100);

		data.NEWS_ADMIN_ID = adminId;

		let id = await NewsModel.insert(data);


		return {
			id
		};
	}

	async delNews(id) {
		let where = {
			_id: id
		}

		// 取出图片数据
		let news = await NewsModel.getOne(where, 'NEWS_PIC');
		if (!news) return;

		await NewsModel.del(where);

		let gradeWhere = {
			GRADE_NEWS_ID: id
		}
		await GradeModel.del(gradeWhere);

		// 异步删除图片 
		let cloudIds = ccminiStrUtil.getArrByKey(news.NEWS_PIC, 'cloudId');
		ccminiCloudUtil.deleteFiles(cloudIds);


		return;
	}


	async delGrade(id) {
		let where = {
			_id: id
		}

		await GradeModel.del(where);
		return;
	}


	async statScoreCnt(newsId) {
		let where = {
			GRADE_NEWS_ID: newsId,
		}
		let cnt = await GradeModel.count(where);

		let data = {
			NEWS_SCORE_CNT: cnt
		}
		await NewsModel.edit(newsId, data);
	}

	async clearGrade(id) {
		let where = {
			GRADE_NEWS_ID: id
		}

		await GradeModel.del(where);

		//异步统计
		this.statScoreCnt(id);

		return;
	}

	async getNewsDetail(id) {
		let fields = '*';

		let where = {
			_id: id
		}
		let news = await NewsModel.getOne(where, fields);
		if (!news) return null;

		let urls = ccminiStrUtil.getArrByKey(news.NEWS_PIC, 'url');
		news.NEWS_PIC = urls;

		return news;
	}


	async updateNewsPic({
		newsId,
		imgList
	}) {

		let newList = await ccminiCloudUtil.getTempFileURL(imgList);

		let news = await NewsModel.getOne(newsId, 'NEWS_PIC');

		let picList = await ccminiCloudUtil.handlerCloudFiles(news.NEWS_PIC, newList);

		let data = {
			NEWS_PIC: picList
		};
		await NewsModel.edit(newsId, data);

		let urls = ccminiStrUtil.getArrByKey(picList, 'url');

		return {
			urls
		};

	}


	async editNews({
		id,
		title,
		cate,
		content,
		desc
	}) {

		let where = {
			NEWS_TITLE: title,
			_id: ['<>', id]
		}
		if (await NewsModel.count(where))
			this.ccminiAppError('该标题已经存在');

		let data = {};
		data.NEWS_TITLE = title;
		data.NEWS_CATE = cate;
		data.NEWS_CONTENT = content;
		data.NEWS_DESC = ccminiStrUtil.fmtText(desc, 100);

		await NewsModel.edit(id, data);
	}

	async getNewsList({
		search,
		sortType,
		sortVal,
		orderBy,
		whereEx,
		page,
		size,
		isTotal = true,
		oldTotal
	}) {

		orderBy = orderBy || {
			'NEWS_ORDER': 'asc',
			'NEWS_ADD_TIME': 'desc'
		};
		let fields = 'NEWS_VIEW_CNT,NEWS_TITLE,NEWS_DESC,NEWS_ADD_TIME,NEWS_ORDER,NEWS_STATUS,NEWS_CATE,NEWS_SCORE_CNT';

		let where = {};

		if (ccminiUtil.isDefined(search) && search) {
			where.NEWS_TITLE = {
				$regex: '.*' + search,
				$options: 'i'
			};
		} else if (sortType && ccminiUtil.isDefined(sortVal)) {
			switch (sortType) {
				case 'cate':
					where.NEWS_CATE = sortVal;
					break;
				case 'status':
					where.NEWS_STATUS = Number(sortVal);
					break;
				case 'sort':
					if (sortVal == 'view') {
						orderBy = {
							'NEWS_VIEW_CNT': 'desc',
							'NEWS_ADD_TIME': 'desc'
						};
					}
					if (sortVal == 'new') {
						orderBy = {
							'NEWS_ADD_TIME': 'desc'
						};
					}

					break;
			}
		}

		return await NewsModel.getList(where, fields, orderBy, page, size, isTotal, oldTotal);
	}

	async getGradeList({
		search,
		id = '0',
		sortType,
		sortVal,
		orderBy,
		whereEx,
		page,
		size,
		isTotal = true,
		oldTotal
	}) {

		orderBy = orderBy || {
			'GRADE_ADD_TIME': 'asc'
		};
		let fields = 'GRADE_NAME,GRADE_NUM,GRADE_SCORE';

		let where = {};
		where.GRADE_NEWS_ID = id;

		if (ccminiUtil.isDefined(search) && search) {
			where.GRADE_NUM = {
				$regex: '.*' + search,
				$options: 'i'
			};
		} else if (sortType && ccminiUtil.isDefined(sortVal)) {
			switch (sortType) {
				case 'score':
					if (sortVal == 'asc') {
						orderBy = {
							'GRADE_SCORE': 'asc',
							'GRADE_ADD_TIME': 'desc'
						};
					}
					if (sortVal == 'desc') {
						orderBy = {
							'GRADE_SCORE': 'desc',
							'GRADE_ADD_TIME': 'desc'
						};
					}

					break;

				case 'num':
					if (sortVal == 'asc') {
						orderBy = {
							'GRADE_NUM': 'asc',
							'GRADE_ADD_TIME': 'desc'
						};
					}
					if (sortVal == 'desc') {
						orderBy = {
							'GRADE_NUM': 'desc',
							'GRADE_ADD_TIME': 'desc'
						};
					}

					break;
			}
		}

		return await GradeModel.getList(where, fields, orderBy, page, size, isTotal, oldTotal);
	}

	async statusNews(id, status) {
		let data = {
			NEWS_STATUS: status
		}
		let where = {
			_id: id,
		}
		return await NewsModel.edit(where, data);
	}

	async sortNews(id, sort) {
		sort = Number(sort)
		let data = {
			NEWS_ORDER: sort
		}
		await NewsModel.edit(id, data);
	}

	async importGrade(newsId, cloudId) {
		const xlsx = require('node-xlsx');

		console.log('############IMPORT SCORE BEGIN....');

		console.log('[IMPORT SCORE]Read Data File');
		const cloud = ccminiCloudBase.getCloud();
		const res = await cloud.downloadFile({
			fileID: cloudId,
		})
		const buffer = await res.fileContent;

		// 删除文件
		ccminiCloudUtil.deleteFiles([cloudId]);

		const sheets = await xlsx.parse(buffer);
		const content = sheets[0].data
		content.splice(0, 1)

		console.log('[IMPORT SCORE]Get SCORE Data begin');
		let where = {
			GRADE_NEWS_ID: newsId
		}
		let allDBGradeData = await GradeModel.getAll(where, 'GRADE_NAME,GRADE_NUM,GRADE_SCORE', {}, 1000000);
		console.log('[IMPORT SCORE]Get SCORE Data COUNT=' + allDBGradeData.length);


		console.log('[IMPORT SCORE]Insert Data');

		let succ = 0;
		let total = 0;
		let allGradeData = []; //用户数据 
		for (let k in content) {
			total++;

			let line = content[k];
			if (line.length < 3) {
				console.error('[' + k + ']Line ERR', line);
				continue;
			};

			//if (total >= 20) break;    

			let gradeData = {};
			gradeData.GRADE_NEWS_ID = newsId;

			// 姓名
			let name = line[0] + '';
			if (!name || name.length < 2) {
				console.error('[' + k + ']name ERR:', line);
				continue;
			}
			gradeData.GRADE_NAME = name.trim();

			// 学号
			let num = line[1] + '';
			if (!num || num.length < 2) {
				console.error('[' + k + ']NUM ERR:', line);
				continue;
			}
			gradeData.GRADE_NUM = num.trim();

			// 成绩
			let score = line[2] + '';
			if (!score || score.length < 1) {
				console.error('[' + k + ']SCORE ERR:', line);
				continue;
			}
			gradeData.GRADE_SCORE = score.trim();

			// 用户是否存在
			if (ccminiStrUtil.checkObjArrExist(allGradeData, gradeData, ['GRADE_NUM'])) {
				//console.error('[' + k + ']SELF USER EXIST ERR:', line);
				continue;
			}

			if (ccminiStrUtil.checkObjArrExist(allDBGradeData, gradeData, ['GRADE_NUM'])) {
				//console.error('[' + k + ']DB USER EXIST ERR:', line);
				continue;
			}

			allGradeData.push(gradeData);

			succ++;

			if (total % 1000 == 0)
				console.log('[' + k + '][IMPORT SCORE]Total=' + total + ', Succ=' + suc);
		}

		//批量插入
		console.log('allGradeData CNT=' + allGradeData.length);
		if (allGradeData.length > 0) {
			GradeModel.insertBatch(allGradeData, 10000);
		}


		console.error('IMPORT SCORE DATA OVER, total=' + total + ', SUCC=' + succ);

		//异步统计
		this.statScoreCnt(newsId);

		return {
			total,
			succ
		}
	}


}

module.exports = AdminService;