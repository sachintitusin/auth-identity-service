export type OAuthAssertion = {
  provider: string;
  providerSubject: string; // immutable external subject (sub)
};
