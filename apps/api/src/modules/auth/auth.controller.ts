import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { loginSchema, PERMISOS_POR_ROL, modulosVisibles } from '@terranova/shared';
import { zodPipe } from '../../common/zod/zod-validation.pipe.js';
import { Actual, Publico } from '../../common/auth/decoradores.js';
import type { UsuarioActual } from '../../common/auth/tipos.js';
import { AuthService } from './auth.service.js';

const COOKIE_ACCESO = 'acceso';
const COOKIE_REFRESCO = 'refresco';

@ApiTags('Autenticacion')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Publico()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Inicia sesion y emite los tokens en cookies httpOnly' })
  async login(
    @Body(zodPipe(loginSchema)) datos: { email: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const resultado = await this.auth.login(datos, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    this.ponerCookies(res, resultado.acceso, resultado.refresco);
    return { usuario: resultado.usuario };
  }

  @Publico()
  @Post('refrescar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rota el token de refresco y emite un nuevo acceso' })
  async refrescar(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string> | undefined)?.[COOKIE_REFRESCO];
    const resultado = await this.auth.refrescar(token ?? '', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    this.ponerCookies(res, resultado.acceso, resultado.refresco);
    return { usuario: resultado.usuario };
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoca la sesion actual' })
  async logout(
    @Actual() usuario: UsuarioActual,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = (req.cookies as Record<string, string> | undefined)?.[COOKIE_REFRESCO];
    await this.auth.cerrarSesion(token, usuario.id);

    res.clearCookie(COOKIE_ACCESO, this.opcionesCookie());
    res.clearCookie(COOKIE_REFRESCO, this.opcionesCookie());
  }

  @Get('yo')
  @ApiOperation({ summary: 'Datos, permisos y modulos visibles del usuario actual' })
  yo(@Actual() usuario: UsuarioActual) {
    return {
      ...usuario,
      permisos: PERMISOS_POR_ROL[usuario.rol],
      modulos: modulosVisibles(usuario.rol),
    };
  }

  /**
   * Los tokens viajan en cookies httpOnly, no en localStorage. El v0
   * guardaba el usuario en localStorage, donde cualquier script de la
   * pagina puede leerlo y donde se podia falsificar la sesion a mano.
   */
  private ponerCookies(res: Response, acceso: string, refresco: string): void {
    const base = this.opcionesCookie();
    res.cookie(COOKIE_ACCESO, acceso, { ...base, maxAge: 15 * 60 * 1000 });
    res.cookie(COOKIE_REFRESCO, refresco, {
      ...base,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth',
    });
  }

  private opcionesCookie() {
    const produccion = this.config.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: produccion,
      sameSite: 'lax' as const,
      path: '/',
    };
  }
}
