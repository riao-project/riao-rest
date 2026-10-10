import {
	AuthenticatedPrincipal,
	BearerAuthenticationScheme,
} from 'api-machine';

export interface RiaoOAuth2TokenAuthenticator<
	TPrincipal extends AuthenticatedPrincipal,
> {
	verifyAccessToken(
		token: string
	): Promise<{ principal_id: string } | null>;
	findActivePrincipal(options: {
		where: Partial<TPrincipal>;
	}): Promise<TPrincipal | null>;
}

export interface RiaoOAuth2BearerAuthenticationOptions {
	schemeName?: string;
	bearerFormat?: string;
	description?: string;
}

export class RiaoOAuth2BearerAuthenticationScheme<
	TPrincipal extends AuthenticatedPrincipal,
> extends BearerAuthenticationScheme {
	public constructor(
		authenticator: RiaoOAuth2TokenAuthenticator<TPrincipal>,
		options: RiaoOAuth2BearerAuthenticationOptions = {}
	) {
		super({
			...options,
			checkToken: async (token) => {
				const payload = await authenticator.verifyAccessToken(token);
				if (!payload) {
					return false;
				}

				return (
					(await authenticator.findActivePrincipal({
						where: {
							id: payload.principal_id,
						} as Partial<TPrincipal>,
					})) ?? false
				);
			},
		});
	}
}