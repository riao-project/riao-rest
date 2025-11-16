import 'jasmine';
import {
	RiaoEndpoint,
	RiaoCreateEndpoint,
	RiaoGetOneEndpoint,
	RiaoGetListEndpoint,
	RiaoDeleteEndpoint,
	RiaoUpdateEndpoint,
} from '../../../src/endpoints';

describe('Endpoints exports', () => {
	it('should export all endpoint classes', () => {
		expect(RiaoEndpoint).toBeDefined();
		expect(RiaoCreateEndpoint).toBeDefined();
		expect(RiaoGetOneEndpoint).toBeDefined();
		expect(RiaoGetListEndpoint).toBeDefined();
		expect(RiaoDeleteEndpoint).toBeDefined();
		expect(RiaoUpdateEndpoint).toBeDefined();
	});
});
